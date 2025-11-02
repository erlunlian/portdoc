.PHONY: help dev migrate seed test lint clean

help:
	@echo "Available commands:"
	@echo "  make dev       - Start all services (docker-compose)"
	@echo "  make migrate   - Run database migrations"
	@echo "  make seed      - Seed database with sample data"
	@echo "  make test      - Run all tests"
	@echo "  make lint      - Run linters"
	@echo "  make clean     - Clean up containers and volumes"

dev:
	cd infra && docker-compose up --build

migrate:
	cd apps/api && alembic upgrade head

seed:
	cd apps/api && python -m scripts.seed

test:
	cd apps/api && pytest
	cd apps/web && pnpm test

lint:
	cd apps/api && ruff check . && black --check .
	cd apps/web && pnpm lint

clean:
	cd infra && docker-compose down -v

