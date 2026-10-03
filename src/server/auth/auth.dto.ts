import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
export class LoginDto { @IsEmail() @MaxLength(254) email!: string; @IsString() @Length(1,128) password!: string; }
export class ForgotDto { @IsEmail() @MaxLength(254) email!: string; }
export class ResetDto { @IsString() @Length(64,64) token!: string; @IsString() @Length(12,128) password!: string; }
export class ChangePasswordDto { @IsString() @Length(1,128) currentPassword!: string; @IsString() @Length(12,128) password!: string; }

