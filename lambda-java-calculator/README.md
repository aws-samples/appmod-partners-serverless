# AWS Lambda Java Calculator
Sample Java project on AWS Lambda 

### Project Build
```bash
sam build
```

### Local Testing
```bash
sam local invoke -e events/test.json
```

### Local Debugging
```bash
sam local invoke -e events/test.json -d 5005
```

_Note: (IntelliJ) Run -> Debug... -> Remote JVM Debug_

### Lambda Deployment
```bash
sam deploy --stack-name java-calculator --guided
```

### Log Monitoring
```bash
sam logs --stack-name java-calculator --tail
```

### Lambda Invocation (AWS CLI)
```bash
aws lambda invoke --function-name java-calculator --payload file://events/test.json --cli-binary-format raw-in-base64-out /tmp/java-calculator.out
```

### Delete Deployment
```bash
sam delete
```

### Reference
https://docs.aws.amazon.com/lambda/latest/dg/lambda-java.html