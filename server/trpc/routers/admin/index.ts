import { router } from "../../trpc";

import { adminConfigProcedures } from "./config";
import { registrationProcedures } from "./registration";
import { authProvidersProcedures } from "./auth-providers";
import { contentConfigProcedures } from "./content-config";
import { aiVideoProcedures, promptsProcedures } from "./ai-video";
import { permissionsProcedures } from "./permissions";
import { systemProcedures } from "./system";

export const adminRouter = router({
  // Config queries
  ...adminConfigProcedures._def.procedures,

  // Registration
  ...registrationProcedures._def.procedures,

  // Auth providers
  auth: authProvidersProcedures,

  // Content config (indicators, units, recurrence)
  content: contentConfigProcedures,

  // AI and video
  ...aiVideoProcedures._def.procedures,

  // AI prompts
  prompts: promptsProcedures,

  // Permissions (recipe policy)
  ...permissionsProcedures._def.procedures,

  // System (scheduler, restart, restore)
  ...systemProcedures._def.procedures,
});
