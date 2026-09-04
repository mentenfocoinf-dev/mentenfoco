// Punto único de importación para la capa de servicios.
// Uso: import { getAdminDirectory, hasPlanAccess } from "../lib/api";
export * from "./plans";
export * from "./themes";
export * from "./authService";
export * from "./adminService";
export * from "./clinicalService";
export * from "./guidesService";
export * from "./sessionsService";
export * from "./messagesService";
export * from "./serviceRequestsService";
export * from "./moodService";
export * from "./onboardingGates";
export * from "./patientOverviewService";
export * from "./contentService";
export * from "./blogCommentsService";
export * from "./clinicalConsentService";
export * from "./publicTestsService";
export * from "./journeyService";
export * from "./recentResources";
export * from "./preferencesService";
export * from "./journalService";
export * from "./directoryService";
export * from "./companiesService";
export * from "./cognitiveRehabService";
export * from "./recommendationsService";
// therapistService expone `getTherapistProfile` con el mismo nombre que
// clinicalService, que lee otra cosa (la cabecera del informe clínico). Se
// re-exporta con alias para no cambiar a qué apunta el nombre que ya se usa.
export {
  updateTherapistProfile,
  listTherapists,
  getTherapistProfile as getTherapistProfessionalProfile,
  AGE_GROUP_LABELS,
  AVAILABILITY_LABELS,
  MODALITY_LABELS,
} from "./therapistService";
export type {
  TherapistProfileRecord,
  TherapistProfileInput,
  TherapyModality,
  AgeGroup,
  AvailabilitySlot,
} from "./therapistService";
export * from "./matchingService";
export * from "./therapistContactService";
export * from "./patientTherapistService";
export * from "./appointmentService";
export * from "./timeBlocksService";
// notificationService expone `markAsRead` igual que messagesService, que llegó
// antes y ya tiene consumidores. En el barril se desambigua con alias; dentro
// de su módulo cada uno conserva el nombre que le corresponde.
export {
  listNotifications,
  markAllAsRead,
  getUnreadCount,
  markAsRead as markNotificationAsRead,
} from "./notificationService";
export type { AppNotification, NotificationEventType } from "./notificationService";
