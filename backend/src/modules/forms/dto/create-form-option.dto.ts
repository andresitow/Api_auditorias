import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export type FormOptionCategory = 'isp' | 'firewall' | 'antivirus';

export class CreateFormOptionDto {
  @ApiProperty({ enum: ['isp', 'firewall', 'antivirus'] })
  @IsIn(['isp', 'firewall', 'antivirus'])
  category: FormOptionCategory;

  @ApiProperty({ example: 'Movistar' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  value: string;
}
