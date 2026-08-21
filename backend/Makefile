COMPOSE ?= docker compose
BACKEND_SERVICE ?= backend
BACKEND_WORKDIR ?= /workspace/backend

.PHONY: test test-unit test-assets test-file

test:
	$(COMPOSE) exec $(BACKEND_SERVICE) bash -lc "cd $(BACKEND_WORKDIR) && pytest"

test-unit:
	$(COMPOSE) exec $(BACKEND_SERVICE) bash -lc "cd $(BACKEND_WORKDIR) && pytest tests"

test-assets:
	$(COMPOSE) exec $(BACKEND_SERVICE) bash -lc "cd $(BACKEND_WORKDIR) && pytest tests/test_assets_routes.py"

test-file:
	@if [ -z "$(FILE)" ]; then \
		echo "FILE=tests/..." >&2; \
		exit 1; \
	fi
	$(COMPOSE) exec $(BACKEND_SERVICE) bash -lc "cd $(BACKEND_WORKDIR) && pytest $(FILE)"
