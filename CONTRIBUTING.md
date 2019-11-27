# Contributing to r7insight_docker

:+1::tada: Thanks for taking the time to contribute! :tada::+1:

## Workflow

- Fork repository in GitHub
- Clone your repository fork
- Work on functionality
- `make build` for building the Docker image
- `make unit-test` for running the unit tests (containerized)
- `make test` for running all the tests
- `make clean` for removing the built Docker image and its tags

Once you have finished implementing the desired functionality, you should open a Pull Request on GitHub  
Once it is approved for merging, you should bump the versioning (this repository uses [SemVer](https://semver.org/)) by running whichever one of the following that makes sense:
- `make bump-major`
- `make bump-minor`
- `make bump-patch`

Push the bump commit into the GitHub PR.  
**Please ensure to push tags as well: `git push --tags` IF you do not `followTags = true` in your ~/.gitconfig**  
At this stage, the Rapid7 team should approve, merge and deploy the new package.

## Testing

All unit tests must be specified in a `test*.js` file in the `tests/` directory.  
Mocha will recursively find tests regardless of nested directories in `tests/`.  

## Deployment/Publishing

You should do the following for both the alpine and buster base:
- `export BUILD_TYPE=node-alpine` (for building alpine)
- `export DOCKER_REGISTRY_PREFIX=<dockerhub-user>/<image-name>` (optional, makefile default is **rapid7/r7insight_docker**)
- `make build`
- `make test`
- `make tag`
- `make push` (Docker image push, will require your account credentials)
- `make clean` (optional for local Docker image cleanup)

You only need to do the following once:
- `make publish` (npm package publish, will require account credentials, update **package.json** if needed)


That's it! Keep in mind that if you changed the **README.md** you will also need to update it manually on Docker Hub.  