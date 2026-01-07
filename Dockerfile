FROM node:18-bullseye

# Install Java
RUN apt-get update && apt-get install -y openjdk-17-jre

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5000

CMD java -jar tika/tika-server.jar --port 9998 & node server.js
