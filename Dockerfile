FROM node:21 AS NODE_BUILD

WORKDIR /go/src/github.com/siyuan-note/siyuan/
ADD . /go/src/github.com/siyuan-note/siyuan/

# RUN sed -i 's|http://deb.debian.org/debian|http://mirrors.aliyun.com/debian|g' /etc/apt/sources.list.d/debian.sources && \
#     sed -i 's|http://deb.debian.org/debian-security|http://mirrors.aliyun.com/debian-security/|g' /etc/apt/sources.list.d/debian.sources
    
RUN cd app && \
    npm config set registry https://registry.npmmirror.com && \
    npm install -g pnpm && \
    pnpm config set registry https://registry.npmmirror.com && \
    pnpm install && \
    pnpm run build

FROM golang:alpine AS GO_BUILD
WORKDIR /go/src/github.com/siyuan-note/siyuan/
COPY --from=NODE_BUILD /go/src/github.com/siyuan-note/siyuan/ /go/src/github.com/siyuan-note/siyuan/
ENV GO111MODULE=on
ENV CGO_ENABLED=1
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories && \
    apk add --no-cache gcc musl-dev && \
    go env -w GOPROXY=https://goproxy.cn,direct && \
    cd kernel && go build --tags fts5 -v -ldflags "-s -w" && \
    mkdir /opt/siyuan/ && \
    mv /go/src/github.com/siyuan-note/siyuan/app/appearance/ /opt/siyuan/ && \
    mv /go/src/github.com/siyuan-note/siyuan/app/stage/ /opt/siyuan/ && \
    mv /go/src/github.com/siyuan-note/siyuan/app/guide/ /opt/siyuan/ && \
    mv /go/src/github.com/siyuan-note/siyuan/app/changelogs/ /opt/siyuan/ && \
    mv /go/src/github.com/siyuan-note/siyuan/kernel/kernel /opt/siyuan/ && \
    mv /go/src/github.com/siyuan-note/siyuan/kernel/entrypoint.sh /opt/siyuan/entrypoint.sh && \
    find /opt/siyuan/ -name .git | xargs rm -rf

FROM alpine:latest
LABEL maintainer="Liang Ding<845765@qq.com>"

WORKDIR /opt/siyuan/
COPY --from=GO_BUILD /opt/siyuan/ /opt/siyuan/

RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories && \
    apk add --no-cache ca-certificates tzdata su-exec && \
    chmod +x /opt/siyuan/entrypoint.sh

ENV TZ=Asia/Shanghai
ENV HOME=/home/siyuan
ENV RUN_IN_CONTAINER=true
EXPOSE 6806

ENTRYPOINT ["/opt/siyuan/entrypoint.sh"]
CMD ["/opt/siyuan/kernel"]
