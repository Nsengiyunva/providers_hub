// User Types
export enum UserRole {
  GUEST = 'GUEST',
  SERVICE_PROVIDER = 'SERVICE_PROVIDER',
  ADMIN = 'ADMIN'
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION'
}

export interface User {
  id: string;
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  phoneNumber?: string;
  phoneVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Service Provider Profile Types
export enum ServiceCategory {
  PHOTOGRAPHY = 'PHOTOGRAPHY',
  CATERING = 'CATERING',
  DECORATION = 'DECORATION',
  ENTERTAINMENT = 'ENTERTAINMENT',
  VENUE = 'VENUE',
  CAKE_DESSERTS = 'CAKE_DESSERTS',
  FLORIST = 'FLORIST',
  MUSIC_DJ = 'MUSIC_DJ',
  VIDEOGRAPHY = 'VIDEOGRAPHY',
  MAKEUP_HAIR = 'MAKEUP_HAIR',
  OTHER = 'OTHER'
}

export interface ServiceProviderProfile {
  id: string;
  userId: string;
  businessName: string;
  category: ServiceCategory;
  description: string;
  bio: string;
  location: {
    city: string;
    state: string;
    country: string;
    zipCode?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  contactInfo: {
    email: string;
    phone: string;
    website?: string;
    socialMedia?: {
      facebook?: string;
      instagram?: string;
      twitter?: string;
      linkedin?: string;
    };
  };
  servicesOffered: string[];
  yearsOfExperience: number;
  certifications?: string[];
  languages?: string[];
  serviceAreas: string[];
  verified: boolean;
  averageRating: number;
  totalReviews: number;
  totalBookings: number;
  responseTime?: number; // in hours
  responseRate?: number; // percentage
  gallery: string[]; // Array of media IDs
  createdAt: Date;
  updatedAt: Date;
}

// Catalog/Service Listing Types
export enum PricingType {
  FIXED = 'FIXED',
  HOURLY = 'HOURLY',
  PER_PERSON = 'PER_PERSON',
  PACKAGE = 'PACKAGE',
  CUSTOM = 'CUSTOM'
}

export interface ServiceListing {
  id: string;
  providerId: string;
  title: string;
  description: string;
  category: ServiceCategory;
  pricingType: PricingType;
  basePrice: number;
  currency: string;
  packages?: ServicePackage[];
  availability: {
    daysAvailable: number[]; // 0-6 (Sunday-Saturday)
    advanceBookingDays: number;
    maxBookingsPerDay: number;
  };
  features: string[];
  includes: string[];
  excludes?: string[];
  termsAndConditions?: string;
  cancellationPolicy?: string;
  active: boolean;
  featured: boolean;
  views: number;
  bookings: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServicePackage {
  id: string;
  name: string;
  description: string;
  price: number;
  duration?: number; // in hours
  features: string[];
  maxGuests?: number;
}

// Inquiry/Booking Types
export enum InquiryStatus {
  PENDING = 'PENDING',
  VIEWED = 'VIEWED',
  RESPONDED = 'RESPONDED',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED'
}

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PAID = 'PAID',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED'
}

export interface Inquiry {
  id: string;
  guestId: string;
  providerId: string;
  serviceListingId?: string;
  eventType: string;
  eventDate: Date;
  eventTime?: string;
  eventLocation: string;
  numberOfGuests?: number;
  packageRequested?: string;
  budgetRange?: {
    min: number;
    max: number;
  };
  message: string;
  status: InquiryStatus;
  contactInfo: {
    name: string;
    email: string;
    phone: string;
  };
  responses?: InquiryResponse[];
  createdAt: Date;
  updatedAt: Date;
}

export interface InquiryResponse {
  id: string;
  inquiryId: string;
  senderId: string;
  message: string;
  quotedPrice?: number;
  attachments?: string[];
  createdAt: Date;
}

export interface Booking {
  id: string;
  inquiryId: string;
  guestId: string;
  providerId: string;
  serviceListingId: string;
  status: BookingStatus;
  eventDetails: {
    type: string;
    date: Date;
    time: string;
    location: string;
    numberOfGuests?: number;
  };
  pricing: {
    basePrice: number;
    additionalCharges?: { name: string; amount: number }[];
    discount?: number;
    tax: number;
    totalAmount: number;
    currency: string;
  };
  paymentStatus: PaymentStatus;
  paymentId?: string;
  specialRequests?: string;
  contractSigned: boolean;
  contractUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
}

// Payment Types
export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED'
}

export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  PAYPAL = 'PAYPAL',
  BANK_TRANSFER = 'BANK_TRANSFER',
  STRIPE = 'STRIPE'
}

export interface Payment {
  id: string;
  bookingId: string;
  guestId: string;
  providerId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  transactionId?: string;
  description: string;
  metadata?: Record<string, any>;
  refunds?: Refund[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Refund {
  id: string;
  paymentId: string;
  amount: number;
  reason: string;
  status: PaymentStatus;
  createdAt: Date;
}

// Review Types
export interface Review {
  id: string;
  bookingId: string;
  providerId: string;
  guestId: string;
  rating: number; // 1-5
  title?: string;
  comment: string;
  photos?: string[];
  response?: ProviderResponse;
  helpful: number;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderResponse {
  message: string;
  createdAt: Date;
}

// Media Types
export enum MediaType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  DOCUMENT = 'DOCUMENT'
}

export interface Media {
  id: string;
  userId: string;
  type: MediaType;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number; // in bytes
  url: string;
  thumbnailUrl?: string;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    tags?: string[];
  };
  uploadedAt: Date;
}

// Notification Types
export enum NotificationType {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  IN_APP = 'IN_APP'
}

export enum NotificationEvent {
  USER_REGISTERED = 'USER_REGISTERED',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
  INQUIRY_RECEIVED = 'INQUIRY_RECEIVED',
  INQUIRY_RESPONSE = 'INQUIRY_RESPONSE',
  BOOKING_CONFIRMED = 'BOOKING_CONFIRMED',
  BOOKING_CANCELLED = 'BOOKING_CANCELLED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  REVIEW_RECEIVED = 'REVIEW_RECEIVED',
  REVIEW_RESPONSE = 'REVIEW_RESPONSE'
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  event: NotificationEvent;
  subject: string;
  content: string;
  data?: Record<string, any>;
  read: boolean;
  sent: boolean;
  sentAt?: Date;
  createdAt: Date;
}

// Kafka Event Types
export interface KafkaEvent<T = any> {
  eventId: string;
  eventType: string;
  timestamp: Date;
  payload: T;
  metadata?: {
    userId?: string;
    correlationId?: string;
    source: string;
  };
}

export interface UserCreatedEvent {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface ProfileCreatedEvent {
  profileId: string;
  userId: string;
  businessName: string;
  category: ServiceCategory;
}

export interface InquiryCreatedEvent {
  inquiryId: string;
  guestId: string;
  providerId: string;
  eventType: string;
  eventDate: Date;
}

export interface BookingConfirmedEvent {
  bookingId: string;
  guestId: string;
  providerId: string;
  eventDate: Date;
  totalAmount: number;
}

export interface PaymentProcessedEvent {
  paymentId: string;
  bookingId: string;
  amount: number;
  status: PaymentStatus;
}

export interface ReviewCreatedEvent {
  reviewId: string;
  providerId: string;
  guestId: string;
  rating: number;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    page?: number;
    limit?: number;
    total?: number;
    timestamp: Date;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Query/Filter Types
export interface QueryOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface ServiceProviderFilters extends QueryOptions {
  category?: ServiceCategory;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  verified?: boolean;
}

export interface InquiryFilters extends QueryOptions {
  status?: InquiryStatus;
  dateFrom?: Date;
  dateTo?: Date;
  providerId?: string;
  guestId?: string;
}

export interface BookingFilters extends QueryOptions {
  status?: BookingStatus;
  dateFrom?: Date;
  dateTo?: Date;
  providerId?: string;
  guestId?: string;
}

export interface ReviewFilters extends QueryOptions {
  providerId?: string;
  minRating?: number;
  verified?: boolean;
}
