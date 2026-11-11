import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiDocument } from './openapi.js';

export function docsRouter(): Router {
  const document = buildOpenApiDocument();
  return Router()
    .get('/openapi.json', (_req, res) => {
      res.json(document);
    })
    .use('/', swaggerUi.serve, swaggerUi.setup(document, { customSiteTitle: 'Store API docs' }));
}
