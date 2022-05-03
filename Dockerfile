FROM node:16-slim
# version arg contains current git tag
# ARG VERSION_ARG
# install git
RUN apt-get update && apt-get install -y git

# install serum-vial globally (exposes 01-flask command)
# RUN npm install --global --unsafe-perm zo-flask@$VERSION_ARG
RUN npm install --global --unsafe-perm zo-flask
# run it
CMD serum-vial