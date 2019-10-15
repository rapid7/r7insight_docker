# Contributing to r7insight_docker

:+1::tada: Thanks for taking the time to contribute! :tada::+1:

## Workflow

- Fork repository in GitHub
- Clone your repository fork
- Work on functionality
- `make build` for building the Docker image
- `make test` for testing the built image
- `make clean` for removing the built docker image and its tags

Once you have finished implementing the desired functionality, you should open a Pull Request on GitHub  
Once it is approved for merging, you should bump the versioning (this repository uses [SemVer](https://semver.org/)) by running whichever one of the following that makes sense:
- `make bump-major`
- `make bump-minor`
- `make bump-patch`

Push the bump commit into the GitHub PR.
At this stage, the Rapid7 team should approve, merge and deploy the new package.

## Deployment/Publishing

You should do the following for both the alpine and onbuild base:
- `export BUILD_TYPE=alpine-node` (for building alpine)
- `export DOCKER_REGISTRY_PREFIX=<dockerhub-user>/<image-name>` (optional, makefile default is **rapid7/r7insight_docker**)
- `make build`
- `make test`
- `make tag`
- `make push` (docker image push, will require your account credentials)
- `make publish` (npm package publish, will require account credentials, update **package.json** if needed)
- `make clean` (optional for local docker image cleanup)
