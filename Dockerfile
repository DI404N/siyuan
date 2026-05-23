FROM --platform=$BUILDPLATFORM node:21 AS node-build
ARG NPM_REGISTRY=https://registry.npmmirror.com
WORKDIR /app
ADD app/package.json app/pnpm* app/.npmrc .
RUN <<EORUN
#!/bin/bash -e
sed -i 's|http://deb.debian.org/debian|http://mirrors.aliyun.com/debian|g' /etc/apt/sources.list.d/debian.sources
sed -i 's|http://deb.debian.org/debian-security|http://mirrors.aliyun.com/debian-security/|g' /etc/apt/sources.list.d/debian.sources
corepack enable
corepack install --global $(node -e 'console.log(require("./package.json").packageManager)')
npm config set registry ${NPM_REGISTRY}
pnpm config set registry ${NPM_REGISTRY}
pnpm install --silent
EORUN
ADD app/ .
RUN <<EORUN
#!/bin/bash -e
pnpm run build
mkdir /artifacts
mv appearance stage guide changelogs /artifacts/
EORUN

FROM golang:1.25-alpine AS go-build
RUN <<EORUN
#!/bin/sh -e
sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories
apk add --no-cache gcc musl-dev
go env -w GO111MODULE=on
go env -w CGO_ENABLED=1
go env -w GOPROXY=https://goproxy.cn,direct
EORUN
WORKDIR /kernel
ADD kernel/go.* .
RUN --mount=type=cache,target=/root/.cache/go-build --mount=type=cache,target=/go/pkg \
    go mod download
ADD kernel/ .
RUN --mount=type=cache,target=/root/.cache/go-build --mount=type=cache,target=/go/pkg \
    go build -tags fts5 -v -ldflags "-s -w"

FROM alpine:latest
LABEL maintainer="Liang Ding<845765@qq.com>"
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories && \
    apk add --no-cache ca-certificates tzdata su-exec
ENV TZ=Asia/Shanghai
ENV HOME=/home/siyuan
ENV RUN_IN_CONTAINER=true
EXPOSE 6806
WORKDIR /opt/siyuan/
COPY --from=go-build --chmod=755 /kernel/kernel /kernel/entrypoint.sh .
COPY --from=node-build /artifacts .
ENTRYPOINT ["/opt/siyuan/entrypoint.sh"]
CMD ["/opt/siyuan/kernel"]