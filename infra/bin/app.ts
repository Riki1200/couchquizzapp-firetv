import { App } from 'aws-cdk-lib';
import { CouchQuizStack } from '../lib/couch-quiz-stack';

const app = new App();
new CouchQuizStack(app, 'CouchQuiz', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1' },
});
