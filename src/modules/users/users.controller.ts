import { getAuth } from '../../middleware/auth.js';
import { validated } from '../../middleware/validate.js';
import { listUsersQuery, updateMeBody, updateRoleBody, userIdParams } from './users.schemas.js';
import { userService } from './users.service.js';

export const userController = {
  me: validated({}, async (_input, req, res) => {
    res.json({ data: await userService.getMe(getAuth(req).user.id) });
  }),

  updateMe: validated({ body: updateMeBody }, async ({ body }, req, res) => {
    res.json({ data: await userService.updateMe(getAuth(req).user.id, body) });
  }),

  list: validated({ query: listUsersQuery }, async ({ query }, _req, res) => {
    res.json(await userService.list(query));
  }),

  setRole: validated(
    { params: userIdParams, body: updateRoleBody },
    async ({ params, body }, req, res) => {
      res.json({ data: await userService.setRole(getAuth(req).user.id, params.id, body.role) });
    },
  ),
};
