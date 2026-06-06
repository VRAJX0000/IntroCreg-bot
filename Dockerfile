FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

RUN npm install --production

# Bundle app source
COPY . .

# Start the bot
CMD [ "npm", "start" ]
