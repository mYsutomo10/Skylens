#Base image
FROM public.ecr.aws/lambda/python:3.9

#Workdir lambda
WORKDIR /var/task

#Workdir lambda
COPY app/ /var/task/

#Install dependencies
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

#Lambda handler
CMD ["main.lambda_handler"]