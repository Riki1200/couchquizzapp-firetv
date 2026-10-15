import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { AnswerRecord, ConnectionRecord, PlayerRecord, RoomRecord, Store } from '../game/store';

const TTL_SECONDS = 24 * 60 * 60; // rooms and connections expire after a day

/**
 * Single-table layout:
 *   pk=ROOM#ABCD  sk=META                  room
 *   pk=ROOM#ABCD  sk=PLAYER#<id>           player
 *   pk=ROOM#ABCD  sk=ANSWER#03#<playerId>  answer to question 3 (conditional put = one answer each)
 *   pk=CONN#<id>  sk=META                  WebSocket connection → room/role/player
 */
export class DynamoStore implements Store {
  private db = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });

  constructor(private table: string) {}

  private ttl() {
    return Math.floor(Date.now() / 1000) + TTL_SECONDS;
  }

  async createRoom(room: RoomRecord) {
    try {
      await this.db.send(
        new PutCommand({
          TableName: this.table,
          Item: { pk: `ROOM#${room.roomCode}`, sk: 'META', ttl: this.ttl(), ...room },
          ConditionExpression: 'attribute_not_exists(pk)',
        }),
      );
      return true;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return false;
      throw error;
    }
  }

  async getRoom(roomCode: string) {
    const { Item } = await this.db.send(new GetCommand({ TableName: this.table, Key: { pk: `ROOM#${roomCode}`, sk: 'META' } }));
    return (Item as RoomRecord | undefined) ?? null;
  }

  async updateRoom(roomCode: string, patch: Partial<RoomRecord>) {
    await this.update({ pk: `ROOM#${roomCode}`, sk: 'META' }, patch);
  }

  async getPlayers(roomCode: string) {
    const items = await this.query(`ROOM#${roomCode}`, 'PLAYER#');
    return (items as PlayerRecord[]).sort((a, b) => a.joinedAt - b.joinedAt);
  }

  async putPlayer(roomCode: string, player: PlayerRecord) {
    await this.db.send(
      new PutCommand({ TableName: this.table, Item: { pk: `ROOM#${roomCode}`, sk: `PLAYER#${player.id}`, ttl: this.ttl(), ...player } }),
    );
  }

  async updatePlayer(roomCode: string, playerId: string, patch: Partial<PlayerRecord>) {
    await this.update({ pk: `ROOM#${roomCode}`, sk: `PLAYER#${playerId}` }, patch);
  }

  async putAnswer(roomCode: string, index: number, answer: AnswerRecord) {
    try {
      await this.db.send(
        new PutCommand({
          TableName: this.table,
          Item: { pk: `ROOM#${roomCode}`, sk: `${answerPrefix(index)}${answer.playerId}`, ttl: this.ttl(), ...answer },
          ConditionExpression: 'attribute_not_exists(sk)',
        }),
      );
      return true;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return false;
      throw error;
    }
  }

  async getAnswers(roomCode: string, index: number) {
    return (await this.query(`ROOM#${roomCode}`, answerPrefix(index))) as AnswerRecord[];
  }

  async putConnection(connection: ConnectionRecord) {
    await this.db.send(
      new PutCommand({ TableName: this.table, Item: { pk: `CONN#${connection.connId}`, sk: 'META', ttl: this.ttl(), ...connection } }),
    );
  }

  async getConnection(connId: string) {
    const { Item } = await this.db.send(new GetCommand({ TableName: this.table, Key: { pk: `CONN#${connId}`, sk: 'META' } }));
    return (Item as ConnectionRecord | undefined) ?? null;
  }

  async deleteConnection(connId: string) {
    await this.db.send(new DeleteCommand({ TableName: this.table, Key: { pk: `CONN#${connId}`, sk: 'META' } }));
  }

  private async query(pk: string, skPrefix: string) {
    const { Items } = await this.db.send(
      new QueryCommand({
        TableName: this.table,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: { ':pk': pk, ':prefix': skPrefix },
      }),
    );
    return Items ?? [];
  }

  private async update(key: { pk: string; sk: string }, patch: object) {
    const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
    if (!entries.length) return;
    await this.db.send(
      new UpdateCommand({
        TableName: this.table,
        Key: key,
        UpdateExpression: `SET ${entries.map((_, i) => `#k${i} = :v${i}`).join(', ')}`,
        ExpressionAttributeNames: Object.fromEntries(entries.map(([k], i) => [`#k${i}`, k])),
        ExpressionAttributeValues: Object.fromEntries(entries.map(([, v], i) => [`:v${i}`, v])),
      }),
    );
  }
}

function answerPrefix(index: number) {
  return `ANSWER#${String(index).padStart(2, '0')}#`;
}
