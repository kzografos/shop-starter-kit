import { Injectable } from '@nestjs/common'

// Every admin responsibility now lives next to its resource (staff,
// notifications, analytics, newsletter, settings, customers, orders,
// categories, products). Left in place, empty, for the cleanup step.
@Injectable()
export class AdminService {}
