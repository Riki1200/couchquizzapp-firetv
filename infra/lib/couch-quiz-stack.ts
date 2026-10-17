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
 *  - The phone controller page opened from the QR code: served by the HTTP API (site=lambda) or by
 *    S3 + CloudFront (site=cloudfront)
 */
export class CouchQuizStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const modelId: string = this.node.tryGetContext('modelId');
    // A second model fact-checks the AI's questions (bedrock-mantle only).
    const checkerModelId: string = this.node.tryGetContext('checkerModelId') ?? '';
    // "mantle": OpenAI-compatible bedrock-mantle endpoint (Mistral, Gemma…); "converse": Bedrock Converse API (Amazon Nova…).
    const aiApi: string = this.node.tryGetContext('aiApi') ?? 'converse';

    // ---------- Storage ----------
    const table = new Table(this, 'GameTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: RemovalPolicy.DESTROY, // game rooms are disposable
    });

    // ---------- Phone controller (static site) ----------
    // Context `site` picks who serves the page the QR code opens:
    //   "lambda"     the HTTP API itself (GET /, /assets/*, /config.json) — no CloudFront needed;
    //   "cloudfront" S3 + CloudFront (new AWS accounts must be verified by AWS Support first);
    //   "local"      a page served from your machine: `-c site=local -c controllerUrl=http://<lan-ip>:5173/`.
    const siteMode: string = this.node.tryGetContext('site') ?? 'lambda';
    let site: { bucket: Bucket; distribution: Distribution } | undefined;
    let controllerUrl: string | undefined = siteMode === 'local' ? this.node.tryGetContext('controllerUrl') : undefined;
    if (siteMode === 'cloudfront') {
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
        bundling: {
          minify: true,
          sourceMap: true,
          target: 'node22',
          // Ship the TV's sound effects (GET /sounds/{file}) and the built phone page (GET /) with the function.
          commandHooks: {
            beforeBundling: () => [],
            beforeInstall: () => [],
            afterBundling: (inputDir: string, outputDir: string) => [
              `cp -r "${inputDir}/backend/assets/sounds" "${outputDir}/sounds"`,
              `cp -r "${inputDir}/apps/controller/dist" "${outputDir}/controller"`,
            ],
          },
        },
        logGroup: new LogGroup(this, `${name}Logs`, { retention: RetentionDays.ONE_WEEK, removalPolicy: RemovalPolicy.DESTROY }),
        ...extra,
        environment: {
          TABLE_NAME: table.tableName,
          MODEL_ID: modelId,
          CHECKER_MODEL_ID: checkerModelId,
          AI_API: aiApi,
          NODE_OPTIONS: '--enable-source-maps',
          ...extra.environment,
        },
      });

    // Bedrock access for the configured models only.
    const bedrockPolicy =
      aiApi === 'mantle'
        ? // bedrock-mantle authorizes inference with CreateInference, narrowed to the writer and checker models.
          new PolicyStatement({
            actions: ['bedrock-mantle:CreateInference'],
            resources: ['*'],
            conditions: { StringEquals: { 'bedrock-mantle:Model': [modelId, checkerModelId].filter(Boolean) } },
          })
        : // Converse: the cross-region inference profile plus the model in every region it can route to.
          new PolicyStatement({
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
    httpFn.addToRolePolicy(bedrockPolicy); // "Surprise me" topic ideas
    // The spoken host: Amazon Polly reads questions and quips (text comes from the room, not the caller).
    httpFn.addToRolePolicy(new PolicyStatement({ actions: ['polly:SynthesizeSpeech'], resources: ['*'] }));

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
    httpApi.addRoutes({ path: '/families/{id}', methods: [HttpMethod.GET], integration: httpIntegration });
    httpApi.addRoutes({ path: '/topic-ideas', methods: [HttpMethod.GET], integration: httpIntegration });
    httpApi.addRoutes({ path: '/rooms/{code}/speech/{index}/{kind}', methods: [HttpMethod.GET], integration: httpIntegration });
    httpApi.addRoutes({ path: '/sounds/{file}', methods: [HttpMethod.GET], integration: httpIntegration });
    httpApi.addRoutes({ path: '/', methods: [HttpMethod.GET], integration: httpIntegration });
    httpApi.addRoutes({ path: '/assets/{file}', methods: [HttpMethod.GET], integration: httpIntegration });
    httpApi.addRoutes({ path: '/config.json', methods: [HttpMethod.GET], integration: httpIntegration });

    // ---------- Upload the controller with its runtime config ----------
    const httpUrl = httpApi.apiEndpoint;
    const wsUrl = webSocketStage.url;
    // Rooms are created by the HTTP function; it puts these URLs into the join link (QR code).
    httpFn.addEnvironment('PUBLIC_HTTP_URL', httpUrl);
    httpFn.addEnvironment('PUBLIC_WS_URL', wsUrl);
    controllerUrl ??= `${httpUrl}/`;
    for (const f of [generateFn, socketFn, httpFn]) f.addEnvironment('CONTROLLER_URL', controllerUrl);
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
