import { z } from "zod";

// User role enum values
export const userRoleEnum = z.enum(["user", "admin"]);

// User status enum values
export const userStatusEnum = z.enum(["ACTIVE", "SUSPENDED", "DELETED"]);

// Schema for creating a new user
export const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  role: userRoleEnum.optional().default("admin"),  // WARNING: Change to "user" after creating first admin
  status: userStatusEnum.optional().default("ACTIVE"),
  phone: z.string().min(10, "Phone number must be at least 10 digits").max(15, "Phone number is too long").optional().or(z.literal("")),
  image: z.string().url("Invalid image URL").optional().or(z.literal("")),
});

// Schema for updating a user
export const updateUserSchema = z.object({
  id: z.string().min(1, "User ID is required"),
  email: z.string().email("Invalid email address").optional(),
  name: z.string().min(1, "Name is required").max(100, "Name is too long").optional(),
  role: userRoleEnum.optional(),
  status: userStatusEnum.optional(),
  phone: z.string().min(10, "Phone number must be at least 10 digits").max(15, "Phone number is too long").optional().or(z.literal("")),
  image: z.string().url("Invalid image URL").optional().or(z.literal("")),
});

// Schema for deleting a user
export const deleteUserSchema = z.object({
  id: z.string().min(1, "User ID is required"),
});

// TypeScript types from schemas
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type DeleteUserInput = z.infer<typeof deleteUserSchema>;
export type UserRole = z.infer<typeof userRoleEnum>;
export type UserStatus = z.infer<typeof userStatusEnum>;
