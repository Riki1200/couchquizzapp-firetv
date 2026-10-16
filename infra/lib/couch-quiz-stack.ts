import * as path from 'path';
import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { HttpApi, HttpMethod, CorsHttpMethod, WebSocketApi, WebSocketStage } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration, WebSocketLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Distribution, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

const REPO_ROOT = path.join(__dirname, '..', '..');

/**
 * Couch Quiz backend:
 *  - DynamoDB: one table for rooms, players, answers and WebSocket connections
 *  - API Gateway HTTP API → Lambda: create/check rooms
 *  - API Gateway WebSocket API → Lambda: real-time game between the TV and the phones
 *  - Lambda (async) → Amazon Bedrock: question generation
 *  - S3 + CloudFront: the phone controller page opened from the QR code
 */
export class CouchQuizStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const modelId: string = this.node.tryGetContext('modelId');

    // ---------- Storage ----------
    const table = new Table(this, 'GameTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: RemovalPolicy.DESTROY, // game rooms are disposable
    });

    // ---------- Phone controller (static site) ----------
    // `-c site=false -c controllerUrl=http://<lan-ip>:5173/` skips S3 + CloudFront (e.g. while a new AWS account
    // is not yet allowed to create CloudFront distributions) and points the QR code at a locally served page.
    const withSite = String(this.node.tryGetContext('site') ?? 'true') !== 'false';
    let site: { bucket: Bucket; distribution: Distribution } | undefined;
    let controllerUrl: string = this.node.tryGetContext('controllerUrl') ?? 'http://localhost:5173/';
    if (withSite) {
      const bucket = new Bucket(this, 'ControllerBucket', {
        blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        enforceSSL: true,
        removalPolicy: RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      });
      const distribution = new Distribution(this, 'ControllerDistribution', {
        defaultBehavior: {
          origin: S3BucketOrigin.withOriginAccessControl(bucket),
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
        defaultRootObject: 'index.html',
      });
      site = { bucket, distribution };
      controllerUrl = `https://${distribution.distributionDomainName}/`;
    }

    // ---------- Lambdas ----------
    const fn = (name: string, handler: string, extra: Partial<NodejsFunctionProps> = {}) =>
      new NodejsFunction(this, name, {
        entry: path.join(REPO_ROOT, 'backend', 'src', 'aws', 'handlers.ts'),
        handler,
        projectRoot: REPO_ROOT,
        depsLockFilePath: path.join(REPO_ROOT, 'yarn.lock'),
        runtime: Runtime.NODEJS_22_X,
        architecture: Architecture.ARM_64,
        memorySize: 512,
        timeout: Duration.seconds(29),
        bundling: { minify: true, sourceMap: true, target: 'node22' },
        logGroup: new LogGroup(this, `${name}Logs`, { retention: RetentionDays.ONE_WEEK, removalPolicy: RemovalPolicy.DESTROY }),
        ...extra,
        environment: {
          TABLE_NAME: table.tableName,
          CONTROLLER_URL: controllerUrl,
          MODEL_ID: modelId,
          NODE_OPTIONS: '--enable-source-maps',
          ...extra.environment,
        },
      });

    // Bedrock: the cross-region inference profile plus the model in every region it can route to.
    const bedrockPolicy = new PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: [
        `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/${modelId}`,
        `arn:aws:bedrock:*::foundation-model/${modelId.replace(/^(us|eu|apac|global)\./, '')}`,
      ],
    });

    const webSocketApi = new WebSocketApi(this, 'GameSocketApi');
    const webSocketStage = new WebSocketStage(this, 'GameSocketStage', {
      webSocketApi,
      stageName: 'prod',
      autoDeploy: true,
    });

    const generateFn = fn('GenerateFunction', 'generate', {
      timeout: Duration.seconds(90), // up to 3 Bedrock attempts
      environment: { WS_ENDPOINT: webSocketStage.callbackUrl },
    });
    const socketFn = fn('SocketFunction', 'ws', {
      environment: { WS_ENDPOINT: webSocketStage.callbackUrl, GENERATE_FUNCTION: generateFn.functionName },
    });
    const httpFn = fn('HttpFunction', 'http');

    table.grantReadWriteData(generateFn);
    table.grantReadWriteData(socketFn);
    table.grantReadWriteData(httpFn);
    webSocketStage.grantManagementApiAccess(generateFn);
    webSocketStage.grantManagementApiAccess(socketFn);
    generateFn.grantInvoke(socketFn);
    generateFn.addToRolePolicy(bedrockPolicy); // questions
    socketFn.addToRolePolicy(bedrockPolicy); // end-of-game awards

    // ---------- APIs ----------
    const socketIntegration = new WebSocketLambdaIntegration('SocketIntegration', socketFn);
    webSocketApi.addRoute('$connect', { integration: socketIntegration });
    webSocketApi.addRoute('$disconnect', { integration: socketIntegration });
    webSocketApi.addRoute('$default', { integration: socketIntegration });

    const httpApi = new HttpApi(this, 'GameHttpApi', {
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST],
        allowHeaders: ['content-type'],
      },
    });
    const httpIntegration = new HttpLambdaIntegration('HttpIntegration', httpFn);
    httpApi.addRoutes({ path: '/rooms', methods: [HttpMethod.POST], integration: httpIntegration });
    httpApi.addRoutes({ path: '/rooms/{code}', methods: [HttpMethod.GET], integration: httpIntegration });

    // ---------- Upload the controller with its runtime config ----------
    const httpUrl = httpApi.apiEndpoint;
    const wsUrl = webSocketStage.url;
    if (site) {
      new BucketDeployment(this, 'DeployController', {
        destinationBucket: site.bucket,
        sources: [
          Source.asset(path.join(REPO_ROOT, 'apps', 'controller', 'dist')),
          Source.jsonData('config.json', { httpUrl, wsUrl }),
        ],
        distribution: site.distribution,
        distributionPaths: ['/*'],
      });
    }

    new CfnOutput(this, 'HttpApiUrl', { value: httpUrl });
    new CfnOutput(this, 'WebSocketUrl', { value: wsUrl });
    new CfnOutput(this, 'ControllerUrl', { value: controllerUrl });
  }
}
