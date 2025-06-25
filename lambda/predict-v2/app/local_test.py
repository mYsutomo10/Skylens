import main
import os

# Simulasi payload EventBridge
event = {
    "sensorId": ["sensor001", "sensor002"]
}

# Simulasi context (bisa kosong untuk test lokal)
class Context:
    def __init__(self):
        self.function_name = "test"
        self.memory_limit_in_mb = 128
        self.invoked_function_arn = "arn:aws:lambda:local:test"
        self.aws_request_id = "123"

context = Context()

# Jalankan Lambda function
response = main.lambda_handler(event, context)
print(response)