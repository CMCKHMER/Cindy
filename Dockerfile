# Sasha Maid — UI build + Python runtime. Only bind-mounted folders are visible.
FROM node:22-alpine AS ui
WORKDIR /ui
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 SASHA_HOME=/data SASHA_THREADS=4
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend backend
COPY config config
COPY --from=ui /ui/dist backend/static
EXPOSE 8765
VOLUME ["/data", "/library"]
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8765"]