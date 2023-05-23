const { Stack } = require('aws-cdk-lib');
const {OrderServiceConstruct} = require("./order-service-construct");

const TABLE_NAME = 'eda-demo-orders';
const EVENT_BUS = 'eda-demo';
const EMAIL = 'youngjeong46@gmail.com';

class AwsEdaDemoStack extends Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    new OrderServiceConstruct(this, 'OrderService', {
      tableName: TABLE_NAME,
      eventBusName: EVENT_BUS,
      notificationEmail: EMAIL
    });
  }
}

module.exports = { AwsEdaDemoStack }
