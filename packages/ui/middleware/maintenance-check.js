export default function maintenanceMiddleware(nuxtContext) {
  const { redirect } = nuxtContext;

  // If env variable IS_MAINTENANCE_ENABLED set to "true"
  // then redirect to maintenance page
  if (process.env.IS_MAINTENANCE_ENABLED === 'true') {
    redirect('/maintenance');
  }

  // else continue
}
