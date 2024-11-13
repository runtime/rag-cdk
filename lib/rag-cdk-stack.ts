import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as iam from 'aws-cdk-lib/aws-iam';

export class RagCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC for Networking
    const vpc = new ec2.Vpc(this, 'AS-RAG-CDK', {
      maxAzs: 2,
      subnetConfiguration: [
        { subnetType: ec2.SubnetType.PUBLIC, name: 'PublicSubnet' },
        { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, name: 'PrivateSubnet' },
      ],
    });

    // EC2 Security Group for SSH
    const ec2SecurityGroup = new ec2.SecurityGroup(this, 'EC2SG', { vpc });
    ec2SecurityGroup.addIngressRule(
        ec2.Peer.ipv4('67.86.185.83/32'), // access via this ip only // home 67.86.185.83
        ec2.Port.tcp(22),
        'Allow SSH from my IP'
    );



    // EC2 Instance for FastAPI
    // const ec2Instance = new ec2.Instance(this, 'RagEC2Instance', {
    //   instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
    //   machineImage: ec2.MachineImage.latestAmazonLinux(),
    //   vpc,
    //   vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC }, // Public subnet
    //   securityGroup: ec2SecurityGroup,
    //   keyName: 'AS-RAG',
    // });

    const ec2Instance = new ec2.Instance(this, 'RagEC2Instance', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroup: ec2SecurityGroup,
      keyName: 'AS-RAG',
    });



    // Security Group for Postgres
    const securityGroup = new ec2.SecurityGroup(this, 'PostgresSG', {
      vpc,
      allowAllOutbound: true,
    });
    securityGroup.addIngressRule(
        ec2.Peer.securityGroupId(ec2SecurityGroup.securityGroupId),
        ec2.Port.tcp(5432),
        'Allow EC2 instances to access Postgres'
    );

    ec2SecurityGroup.addIngressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.tcp(22),
        'Allow SSH access from anywhere');


    // RDS Postgres Instance
    const dbInstance = new rds.DatabaseInstance(this, 'ASRagPostgres', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_14 }),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [securityGroup],
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MICRO),
      credentials: rds.Credentials.fromGeneratedSecret('postgres'),
      databaseName: 'ASRagDB',
    });

    // Grant EC2 access to Secrets Manager
    ec2Instance.role.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
    );

  }
}
