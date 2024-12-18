import json
import boto3
import traceback
import os
from decimal import Decimal

def safe_convert_to_numeric(value, default=0):
    """
    Safely convert input to a numeric value.
    """
    if value is None:
        return default
    try:
        return Decimal(value)
    except (ValueError, TypeError):
        return Decimal(default)

def analyze_migration_strategy(server_data):
    """
    Determine the most appropriate migration strategy based on server characteristics.
    """
    strategy_scores = {
        'lift_and_shift': 0,
        'refactor': 0,
        'rebuild': 0,
        'hybrid': 0
    }
    
    cpu_util = safe_convert_to_numeric(server_data.get('cpu', server_data.get('cpu_utilization', 0)))
    memory_util = safe_convert_to_numeric(server_data.get('memory', server_data.get('memory_utilization', 0)))
    network_util = safe_convert_to_numeric(server_data.get('network_utilization', 0))
    
    # CPU Utilization Analysis
    if cpu_util < 30:
        strategy_scores['lift_and_shift'] += 2
        strategy_scores['hybrid'] += 1
    elif 30 <= cpu_util < 70:
        strategy_scores['refactor'] += 2
        strategy_scores['hybrid'] += 1
    else:
        strategy_scores['rebuild'] += 2
        strategy_scores['hybrid'] += 1
    
    # Memory Utilization Analysis
    if memory_util < 40:
        strategy_scores['lift_and_shift'] += 1
    elif 40 <= memory_util < 80:
        strategy_scores['refactor'] += 1
        strategy_scores['hybrid'] += 1
    else:
        strategy_scores['rebuild'] += 1
    
    # Network Utilization Analysis
    if network_util < 50:
        strategy_scores['lift_and_shift'] += 1
    elif 50 <= network_util < 80:
        strategy_scores['hybrid'] += 1
    else:
        strategy_scores['refactor'] += 1
    
    # Determine the primary strategy
    primary_strategy = max(strategy_scores, key=strategy_scores.get)
    return primary_strategy, strategy_scores

def calculate_migration_cost(strategy_scores):
    """
    Calculate the approximate cost for migration based on strategy scores.
    """
    base_cost = Decimal(500)
    lift_and_shift_cost = base_cost * (1 + Decimal(0.2) * strategy_scores.get('lift_and_shift', 0))
    refactor_cost = base_cost * (1 + Decimal(0.3) * strategy_scores.get('refactor', 0))
    rebuild_cost = base_cost * (1 + Decimal(0.5) * strategy_scores.get('rebuild', 0))
    hybrid_cost = base_cost * (1 + Decimal(0.4) * strategy_scores.get('hybrid', 0))
    average_cost = (lift_and_shift_cost + refactor_cost + rebuild_cost + hybrid_cost) / 4
    return round(average_cost, 2)

def lambda_handler(event, context):
    """
    Main Lambda handler function.
    """
    print(f"DEBUG: Full incoming event: {json.dumps(event, indent=2)}")
    
    dynamodb = boto3.resource('dynamodb')
    table_name = os.environ.get('DYNAMODB_TABLE', 'MigrationData')
    table = dynamodb.Table(table_name)
    
    try:
        # Check for S3 event
        if 'Records' in event and 's3' in event['Records'][0]:
            return process_s3_event(event, table)
        
        # Check for API Gateway event with a method (GET, POST, etc.)
        elif 'httpMethod' in event:
            return process_api_gateway_event(event, table)
        
        # Check for API Gateway event with path parameters
        elif 'pathParameters' in event:
            return process_api_gateway_event_with_path(event, table)
        
        else:
            print(f"ERROR: Unsupported event type: {json.dumps(event)}")
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'error': 'Unsupported event source',
                    'details': str(event)
                })
            }
    except Exception as e:
        print(f"ERROR: Exception in lambda_handler: {str(e)}")
        print(traceback.format_exc())
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Internal Server Error',
                'details': str(e)
            })
        }

def process_s3_event(event, table):
    """
    Process events triggered from S3.
    """
    s3 = boto3.client('s3')
    bucket_name = event['Records'][0]['s3']['bucket']['name']
    key = event['Records'][0]['s3']['object']['key']
    response = s3.get_object(Bucket=bucket_name, Key=key)
    data = response['Body'].read().decode('utf-8')
    
    try:
        server_data = json.loads(data)
    except json.JSONDecodeError:
        raise ValueError("Invalid JSON format in S3 object")
    
    if isinstance(server_data, dict):
        server_data = [server_data]
    
    for server in server_data:
        process_server_record(server, table)
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Data processed successfully from S3',
            'records_processed': len(server_data)
        })
    }

def process_api_gateway_event(event, table):
    """
    Process events triggered from API Gateway.
    """
    http_method = event.get('httpMethod')
    
    if http_method == 'POST':
        try:
            body = event.get('body', '{}')
            server_data = json.loads(body)
            result = process_server_record(server_data, table)
            return {
                'statusCode': 201,
                'body': json.dumps({
                    'message': 'Server data added successfully',
                    'details': result
                })
            }
        except Exception as e:
            print(f"ERROR: POST request processing failed: {str(e)}")
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'error': 'Failed to process request',
                    'details': str(e)
                })
            }
    else:
        return {
            'statusCode': 405,
            'body': json.dumps({
                'error': 'Method Not Allowed',
                'allowed_methods': ['POST']
            })
        }

def process_api_gateway_event_with_path(event, table):
    """
    Process events triggered from API Gateway that include pathParameters.
    """
    server_id = event['pathParameters'].get('server_id')
    
    if server_id:
        # Assume you want to retrieve data or perform some operation using server_id
        response = table.get_item(Key={'server_name': server_id})
        
        if 'Item' in response:
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'Server found',
                    'server': response['Item']
                })
            }
        else:
            return {
                'statusCode': 404,
                'body': json.dumps({
                    'error': 'Server not found',
                    'server_id': server_id
                })
            }
    
    return {
        'statusCode': 400,
        'body': json.dumps({
            'error': 'Missing server_id in pathParameters'
        })
    }

def process_server_record(server_data, table):
    """
    Process and store a single server record.
    """
    if not server_data.get('server_name'):
        server_data['server_name'] = 'Unknown Server'
    
    primary_strategy, strategy_scores = analyze_migration_strategy(server_data)
    estimated_cost = calculate_migration_cost(strategy_scores)
    
    dynamodb_item = {
        'server_name': str(server_data.get('server_name', 'Unknown Server')),
        'instance_type': str(server_data.get('instance_type', 'N/A')),
        'cpu_utilization': str(server_data.get('cpu', server_data.get('cpu_utilization', 0))),
        'memory_utilization': str(server_data.get('memory', server_data.get('memory_utilization', 0))),
        'storage': json.dumps(server_data.get('storage', {})),
        'network_utilization': str(server_data.get('network_utilization', 0)),
        'software': json.dumps(server_data.get('software_dependencies', server_data.get('software', []))),
        'primary_strategy': primary_strategy.title(),
        'strategy_scores': json.dumps(strategy_scores),
        'cost': str(estimated_cost)
    }
    
    table.put_item(Item=dynamodb_item)
    return {
        'server_name': dynamodb_item['server_name'],
        'primary_strategy': primary_strategy,
        'estimated_cost': estimated_cost
    }