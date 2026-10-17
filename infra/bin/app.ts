import { App } from 'aws-cdk-lib';
import { CouchQuizStack } from '../lib/couch-quiz-stack';

const app = new App();
// `-c stack=CouchQuizDev` deploys a separate copy (e.g. to test a branch without touching the live backend).
new CouchQuizStack(app, app.node.tryGetContext('stack') ?? 'CouchQuiz', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1' },
});
