FROM node:16-slim
# version arg contains current git tag
ARG VERSION_ARG
# install git
RUN apt-get update && apt-get install -y git

# install serum-vial globally (exposes 01-flask command)
RUN npm install --global --unsafe-perm 01-flask@$VERSION_ARG
# run it
CMD 01-flask