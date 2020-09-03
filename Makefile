NODE_VERSION ?=$(shell grep FROM Dockerfile | cut -d ':' -f 2| cut -d '-' -f 1)

# We support two build modes, node-buster or node-alpine
BUILD_TYPE ?=node-buster

NAME ?=r7insight_docker
NAME_BUILD_CONTAINER ?=${NAME}-build-${BUILD_TYPE}
NAME_TEST_CONTAINER ?=${NAME}-test-${BUILD_TYPE}
NAME_EXPORT_CONTAINER ?=${NAME}-export-${BUILD_TYPE}

DOCKER_REGISTRY_PREFIX ?=rapid7/${NAME}
DOCKER_REGISTRY_IMAGE_VERSION ?=$(shell cat VERSION)

# Use node-alpine
ifeq (${BUILD_TYPE},node-alpine)
	DOCKERFILE_PREFIX ?=alpine.
	DOCKER_REGISTRY_IMAGE_TAG_POSTFIX ?=-alpine
endif

# Random token
LOG_TOKEN ?=00112233-4455-6677-8899-aabbccddeeff
WAIT_TIME ?=5

.PHONY: default build unit-test start-test test tag push publish bump-major \
		bump-minor bump-patch export clean help
default: help

build: ## Builds a new Docker image
	@echo "[build] Build type: ${BUILD_TYPE}"
	@echo "[build] Building new image"
	docker build --rm -t "${NAME_BUILD_CONTAINER}" -f "${DOCKERFILE_PREFIX}Dockerfile" .

unit-test: ## Run the unit tests
	@npm test

start-test: ## Tests a previous build Docker image to see if starts
	@echo "[test] Removing existing test container if any"
	@-docker rm -f "${NAME_TEST_CONTAINER}" &>/dev/null
	@echo "[test] Starting a test container"
	@#	Ensure Docker image exists
	@docker images | grep -q "${NAME_BUILD_CONTAINER}" || \
		(echo "[test] Docker image not found, running 'make build'" && make build)
	@docker run -d --name "${NAME_TEST_CONTAINER}" \
		-v /var/run/docker.sock:/var/run/docker.sock --read-only --security-opt=no-new-privileges \
       	"${NAME_BUILD_CONTAINER}" -t "${LOG_TOKEN}" -r us -a host="${NAME_TEST_CONTAINER}" &>/dev/null
	@echo "[test] Testing if the container stays running"
	@echo "[test] Waiting for ${WAIT_TIME} seconds"
	@sleep "${WAIT_TIME}"
	@#	If container name doesn't exist, echo, and remove the container
	@docker ps | grep -q "${NAME_TEST_CONTAINER}" || \
		(echo "[test] Container exited and failed." && \
		(docker rm -f "${NAME_TEST_CONTAINER}" &>/dev/null && \
		 false))
	@echo "[test] Cleaning up test container ${NAME_TEST_CONTAINER}"
	@-docker rm -f "${NAME_TEST_CONTAINER}" &>/dev/null

test: unit-test start-test ## Run all tests

tag: ## Tags local build image to make it ready for push to Docker registry
	docker tag "$(shell docker images -q ${NAME_BUILD_CONTAINER})" "${DOCKER_REGISTRY_PREFIX}:${DOCKER_REGISTRY_IMAGE_VERSION}${DOCKER_REGISTRY_IMAGE_TAG_POSTFIX}"
	docker tag "$(shell docker images -q ${NAME_BUILD_CONTAINER})" "${DOCKER_REGISTRY_PREFIX}:latest${DOCKER_REGISTRY_IMAGE_TAG_POSTFIX}"

push: ## Push local versioned and latest images to the Docker registry
	docker push "${DOCKER_REGISTRY_PREFIX}:${DOCKER_REGISTRY_IMAGE_VERSION}${DOCKER_REGISTRY_IMAGE_TAG_POSTFIX}"
	docker push "${DOCKER_REGISTRY_PREFIX}:latest${DOCKER_REGISTRY_IMAGE_TAG_POSTFIX}"

publish: ## Publish npm package
	npm publish

bump-major: ## Bump the major version (1.0.0 -> 2.0.0)
	@echo "Current version: ${DOCKER_REGISTRY_IMAGE_VERSION}"
	@DOCKER_REGISTRY_IMAGE_VERSION="$(shell docker run --rm -v "${PWD}":/app treeder/bump major)"
	@#	Don't add git tag and commit
	@npm version --no-git-tag-version major
	@echo "New version: ${DOCKER_REGISTRY_IMAGE_VERSION}"
	@git add VERSION package.json package-lock.json
	@git commit -m "Bump version to ${DOCKER_REGISTRY_IMAGE_VERSION}"
	@git tag -a "${DOCKER_REGISTRY_IMAGE_VERSION}" -m "Releasing version ${DOCKER_REGISTRY_IMAGE_VERSION}"

bump-minor: ## Bump the minor version (0.1.0 -> 0.2.0)
	@echo "Current version: ${DOCKER_REGISTRY_IMAGE_VERSION}"
	@DOCKER_REGISTRY_IMAGE_VERSION="$(shell docker run --rm -v "${PWD}":/app treeder/bump minor)"
	@#	Don't add git tag and commit
	@npm version --no-git-tag-version minor
	@echo "New version: ${DOCKER_REGISTRY_IMAGE_VERSION}"
	@git add VERSION package.json package-lock.json
	@git commit -m "Bump version to ${DOCKER_REGISTRY_IMAGE_VERSION}"
	@git tag -a "${DOCKER_REGISTRY_IMAGE_VERSION}" -m "Releasing version ${DOCKER_REGISTRY_IMAGE_VERSION}"

bump-patch: ## Bump the patch version (0.0.1 -> 0.0.2)
	@echo "Current version: ${DOCKER_REGISTRY_IMAGE_VERSION}"
	@DOCKER_REGISTRY_IMAGE_VERSION="$(shell docker run --rm -v "${PWD}":/app treeder/bump patch)"
	@#	Don't add git tag and commit
	@npm version --no-git-tag-version patch
	@echo "New version: ${DOCKER_REGISTRY_IMAGE_VERSION}"
	@git add VERSION package.json package-lock.json
	@git commit -m "Bump version to ${DOCKER_REGISTRY_IMAGE_VERSION}"
	@git tag -a "${DOCKER_REGISTRY_IMAGE_VERSION}" -m "Releasing version ${DOCKER_REGISTRY_IMAGE_VERSION}"

export: ## Export the build as a tarball
	-docker rm -f "${NAME_EXPORT_CONTAINER}"
	@docker images | grep -q "${NAME_BUILD_CONTAINER}" || \
		(echo "[test] Docker image not found, running 'make build'" && make build)
	docker create --name "${NAME_EXPORT_CONTAINER}" "${NAME_BUILD_CONTAINER}"
	docker export -o "${NAME}-${DOCKER_REGISTRY_IMAGE_VERSION}${DOCKER_REGISTRY_IMAGE_TAG_POSTFIX}.tar" `docker ps -a -q -f 'name=${NAME_EXPORT_CONTAINER}'`

clean: ## Remove Docker images from build and tag commands
	@#	This expands to 3 images, build, latest versioned (0.9.0) and latest
	-docker image rm "${NAME_BUILD_CONTAINER}" ${DOCKER_REGISTRY_PREFIX}:{${DOCKER_REGISTRY_IMAGE_VERSION},latest}${DOCKER_REGISTRY_IMAGE_TAG_POSTFIX} \
                     "${NAME_UNITTEST}"

help: ## Shows help
	@echo "================================================================================================="
	@echo "support build types are:"
	@echo "- BUILD_TYPE=node-buster (default)"
	@echo "- BUILD_TYPE=node-alpine"
	@echo ""
	@echo "set the environment variable accordingly to change the build type"
	@echo "================================================================================================="
	@IFS=$$'\n' ; \
    help_lines=(`fgrep -h "##" ${MAKEFILE_LIST} | fgrep -v fgrep | sed -e 's/\\$$//'`); \
    for help_line in $${help_lines[@]}; do \
        IFS=$$'#' ; \
        help_split=($$help_line) ; \
        help_command=`echo $${help_split[0]} | sed -e 's/^ *//' -e 's/ *$$//'` ; \
        help_info=`echo $${help_split[2]} | sed -e 's/^ *//' -e 's/ *$$//'` ; \
        printf "%-30s %s\n" $$help_command $$help_info ; \
    done

