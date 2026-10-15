FROM python:3.12-slim

WORKDIR /app

# Install backend dependencies.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Include the database initialization script.
COPY main.py database.py models.py create_tables.py ./

EXPOSE 8000

# Create missing database tables before starting FastAPI.
CMD ["sh", "-c", "python create_tables.py && exec uvicorn main:app --host 0.0.0.0 --port 8000"]
