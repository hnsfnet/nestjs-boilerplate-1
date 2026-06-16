import { Injectable } from '@nestjs/common';
import { TokenService } from './token.service';
import { MailService } from '../../mail/mail.service';
import { User } from '../../users/domain/user';

@Injectable()
export class AuthNotificationService {
  constructor(
    private readonly tokenService: TokenService,
    private readonly mailService: MailService,
  ) {}

  async sendSignUpConfirmation(
    email: string,
    userId: User['id'],
  ): Promise<void> {
    const hash = await this.tokenService.signConfirmEmailToken({
      confirmEmailUserId: userId,
    });

    await this.mailService.userSignUp({
      to: email,
      data: { hash },
    });
  }

  async sendForgotPassword(
    email: string,
    userId: User['id'],
  ): Promise<void> {
    const { hash, tokenExpires } =
      await this.tokenService.signForgotPasswordToken(userId);

    await this.mailService.forgotPassword({
      to: email,
      data: { hash, tokenExpires },
    });
  }

  async sendConfirmNewEmail(
    email: string,
    userId: User['id'],
    newEmail: string,
  ): Promise<void> {
    const hash = await this.tokenService.signConfirmEmailToken({
      confirmEmailUserId: userId,
      newEmail,
    });

    await this.mailService.confirmNewEmail({
      to: email,
      data: { hash },
    });
  }
}
