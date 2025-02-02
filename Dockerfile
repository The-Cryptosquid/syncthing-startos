FROM syncthing/syncthing:1.23.0

FROM alpine:3.15

RUN apk add --no-cache tini
RUN apk add --no-cache jq
RUN apk add --no-cache curl
RUN apk add --no-cache inotify-tools

ARG PLATFORM

RUN wget -qO /usr/local/bin/yq https://github.com/mikefarah/yq/releases/latest/download/yq_linux_${PLATFORM} && chmod +x /usr/local/bin/yq

COPY --from=0 /bin/syncthing /usr/bin/

RUN adduser --disabled-password syncthing_user

COPY docker_files/entrypoint.sh /usr/local/bin/entrypoint.sh

COPY docker_files/health-web.sh /usr/bin
COPY docker_files/watch-and-own.sh /usr/bin
COPY docker_files/force-own.sh /usr/bin
COPY docker_files/health-version.sh /usr/bin

EXPOSE 8384/tcp
EXPOSE 22000/tcp

EXPOSE 8384/udp
EXPOSE 22000/udp

ENTRYPOINT ["tini"]

CMD ["entrypoint.sh"]
