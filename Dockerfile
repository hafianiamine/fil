FROM node:20

WORKDIR /app

COPY . .

RUN npm install express aws-sdk cors dotenv

EXPOSE 3000

CMD ["node", "server.js"]
