FROM node:16-slim
# version arg contains current git tag
ARG VERSION_ARG
# install git
RUN apt-get update && apt-get install -y git

# install serum-vial globally (exposes 01-flask command)
RUN npm install --global --unsafe-perm 01-flask@$VERSION_ARG
# run it
CMD 01-flask --endpoint https://merstab-main-1336.mainnet.rpcpool.com/4e83182e-8757-4a84-81e6-5f0c153bd3a0
