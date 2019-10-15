NODE_VERSION ?=$(shell grep FROM Dockerfile | cut -d ':' -f 2| cut -d '-' -f 1)

# We support two build modes , node-onbuild or alpine-node
BUILD_TYPE ?=node-onbuild

NAME_CONTAINER ?=r7insight_docker
NAME_BUILD_CONTAINER ?=$(NAME_CONTAINER)-build-$(BUILD_TYPE)
NAME_TEST_CONTAINER ?=$(NAME_CONTAINER)-test-$(BUILD_TYPE)
NAME_EXPORT_CONTAINER ?=$(NAME_CONTAINER)-export-$(BUILD_TYPE)

DOCKER_REGISTRY_PREFIX ?=rapid7/$(NAME_CONTAINER)
DOCKER_REGISTRY_IMAGE_VERSION ?=$(shell cat VERSION)

# Use the alpine node 
ifeq ($(BUILD_TYPE),alpine-node)
DOCKERFILE_SUFFIX ?=.alpine
DOCKER_REGISTRY_IMAGE_TAG_PREFIX ?=alpine-
else
DOCKERFILE_SUFFIX ?=
DOCKER_REGISTRY_IMAGE_TAG_PREFIX ?=
endif

# Just a random token
LOGENTRIES_TOKEN ?=XAXAXAXAXA
WAIT_TIME ?=5

.PHONY: default build test tag push publish bump-major bump-minor bump-patch export clean help
default: help

build: ## Builds a new docker image
	echo $(BUILD_TYPE)
	echo $(DOCKERFILE_SUFFIX)
	@echo "[build] Building new image"
	docker build --rm=true --tag=$(NAME_BUILD_CONTAINER) -f Dockerfile$(DOCKERFILE_SUFFIX) . 

test: ## Tests a previous build docker image to see if starts
	@echo "[test] Removing existing test container if any"
	@docker rm -f $(NAME_TEST_CONTAINER) > /dev/null 2>&1 || true
	@echo "[test] Starting a test container"
	@#	Ensure docker image exists
	@docker images | grep -q "$(NAME_BUILD_CONTAINER)" || \
		(echo "[test] Docker image not found, run 'make test'" && false)
	@docker run -d --name=$(NAME_TEST_CONTAINER) \
		-v /var/run/docker.sock:/var/run/docker.sock \
  $(NAME_BUILD_CONTAINER) -t $(LOGENTRIES_TOKEN) -j -a host=$(NAME_TEST_CONTAINER)  > /dev/null 2>&1
	@echo "[test] Testing if the container stays running"
	@echo "[test] Waiting for $(WAIT_TIME) seconds"
	@sleep $(WAIT_TIME)
	@docker ps | grep $(NAME_TEST_CONTAINER) | wc -l
	@echo "[test] Cleaning up test container $(NAME_TEST_CONTAINER)"
	@docker rm -f $(NAME_TEST_CONTAINER) > /dev/null 2>&1 || true

tag: ## Tags local build image to make it ready for push to docker registry
	docker tag "$(shell docker images -q ${NAME_BUILD_CONTAINER})" "${DOCKER_REGISTRY_PREFIX}:${DOCKER_REGISTRY_IMAGE_TAG_PREFIX}${DOCKER_REGISTRY_IMAGE_VERSION}"
	docker tag "$(shell docker images -q ${NAME_BUILD_CONTAINER})" "${DOCKER_REGISTRY_PREFIX}:${DOCKER_REGISTRY_IMAGE_TAG_PREFIX}latest"

push: ## Push local versioned and latest images to the docker registry
	docker push "$(DOCKER_REGISTRY_PREFIX):$(DOCKER_REGISTRY_IMAGE_TAG_PREFIX)$(DOCKER_REGISTRY_IMAGE_VERSION)"
	docker push "$(DOCKER_REGISTRY_PREFIX):$(DOCKER_REGISTRY_IMAGE_TAG_PREFIX)latest"

publish: ## Publish npm package
	npm publish

bump-major: ## Bump the major version (1.0.0 -> 2.0.0)
	@echo "Current version: ${DOCKER_REGISTRY_IMAGE_VERSION}"
	@DOCKER_REGISTRY_IMAGE_VERSION="$(shell docker run --rm -v "${PWD}":/app treeder/bump major)"
	@#	Don't add git tag and commit
	@npm version --no-git-tag-version major
	@echo "New version: ${DOCKER_REGISTRY_IMAGE_VERSION}"
	@git add VERSION package.json
	@git commit -m "Bump version to ${DOCKER_REGISTRY_IMAGE_VERSION}"

bump-minor: ## Bump the minor version (0.1.0 -> 0.2.0)
	@echo "Current version: ${DOCKER_REGISTRY_IMAGE_VERSION}"
	@DOCKER_REGISTRY_IMAGE_VERSION="$(shell docker run --rm -v "${PWD}":/app treeder/bump minor)"
	@#	Don't add git tag and commit
	@npm version --no-git-tag-version minor
	@echo "New version: ${DOCKER_REGISTRY_IMAGE_VERSION}"
	@git add VERSION package.json
	@git commit -m "Bump version to ${DOCKER_REGISTRY_IMAGE_VERSION}"

bump-patch: ## Bump the patch version (0.0.1 -> 0.0.2)
	@echo "Current version: ${DOCKER_REGISTRY_IMAGE_VERSION}"
	@DOCKER_REGISTRY_IMAGE_VERSION="$(shell docker run --rm -v "${PWD}":/app treeder/bump patch)"
	@#	Don't add git tag and commit
	@npm version --no-git-tag-version patch
	@echo "New version: ${DOCKER_REGISTRY_IMAGE_VERSION}"
	@git add VERSION package.json
	@git commit -m "Bump version to ${DOCKER_REGISTRY_IMAGE_VERSION}"

export: ## Export the build as a tarball
	-docker rm -f $(NAME_EXPORT_CONTAINER)
	docker create --name $(NAME_EXPORT_CONTAINER) $(NAME_BUILD_CONTAINER)
	docker export -o "logentries-${DOCKER_REGISTRY_IMAGE_TAG_PREFIX}${DOCKER_REGISTRY_IMAGE_VERSION}.tar" `docker ps -a -q -f 'name=$(NAME_EXPORT_CONTAINER)'`

clean: ## Remove docker images from build and tag commands
	@#	This expands to 3 images, build, latest versioned (0.9.0) and latest
	-docker image rm "${NAME_BUILD_CONTAINER}" ${DOCKER_REGISTRY_PREFIX}:${DOCKER_REGISTRY_IMAGE_TAG_PREFIX}{${DOCKER_REGISTRY_IMAGE_VERSION},latest}

help: ## Shows help
	@echo "================================================================================================="
	@echo "support build types are:"
	@echo "- BUILD_TYPE=node-onbuild (default)"
	@echo "- BUILD_TYPE=alpine-node"
	@echo ""
	@echo "set the environment accordingly to change the build type"
	@echo "================================================================================================="
	@IFS=$$'\n' ; \
    help_lines=(`fgrep -h "##" $(MAKEFILE_LIST) | fgrep -v fgrep | sed -e 's/\\$$//'`); \
    for help_line in $${help_lines[@]}; do \
        IFS=$$'#' ; \
        help_split=($$help_line) ; \
        help_command=`echo $${help_split[0]} | sed -e 's/^ *//' -e 's/ *$$//'` ; \
        help_info=`echo $${help_split[2]} | sed -e 's/^ *//' -e 's/ *$$//'` ; \
        printf "%-30s %s\n" $$help_command $$help_info ; \
    done

