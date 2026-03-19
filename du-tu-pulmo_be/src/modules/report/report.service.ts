import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Report,
  ReportType,
  ReportStatus,
} from '@/modules/report/entities/report.entity';
import { CreateReportDto } from '@/modules/report/dto/create-report.dto';
import { UpdateReportDto } from '@/modules/report/dto/update-report.dto';
import { ResponseCommon } from '@/common/dto/response.dto';
import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Report)
    private reportRepository: Repository<Report>,
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
  ) {}

  async create(
    createReportDto: CreateReportDto,
    reporterId: string,
  ): Promise<ResponseCommon<Report>> {
    const { doctorId, appointmentId, content, reportType } = createReportDto;

    // Validate: phải có ít nhất 1 trong 2 (trừ khi là system report)
    if (!doctorId && !appointmentId && reportType !== ReportType.SYSTEM) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    if (!content) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    // Check reporter is doctor or patient of appointment
    if (appointmentId) {
      const appointment = await this.appointmentRepository.findOne({
        where: { id: appointmentId },
        relations: ['doctor', 'patient', 'doctor.user', 'patient.user'],
      });

      if (!appointment) {
        throw new NotFoundException(ERROR_MESSAGES.APPOINTMENT_NOT_FOUND);
      }

      const isPatient = appointment.patient.user.id === reporterId;
      const isDoctor = appointment.doctor.user.id === reporterId;

      if (!isPatient && !isDoctor) {
        throw new ForbiddenException(ERROR_MESSAGES.ACCESS_DENIED);
      }
    }

    // Check duplicate report
    const existingReport = await this.reportRepository.findOne({
      where: {
        reporterId,
        ...(doctorId && { doctorId }),
        ...(appointmentId && { appointmentId }),
        status: ReportStatus.PENDING,
      },
    });

    if (existingReport) {
      throw new BadRequestException(ERROR_MESSAGES.REPORT_ALREADY_EXISTS);
    }

    // Determine report type
    let finalReportType = reportType;
    if (!finalReportType) {
      if (appointmentId) {
        finalReportType = ReportType.APPOINTMENT;
      } else if (doctorId) {
        finalReportType = ReportType.DOCTOR;
      } else {
        finalReportType = ReportType.SYSTEM;
      }
    }

    const report = this.reportRepository.create({
      content,
      reporterId,
      doctorId,
      appointmentId,
      reportType: finalReportType,
    });

    const saved = await this.reportRepository.save(report);
    return new ResponseCommon(201, 'Gửi báo cáo thành công', saved);
  }

  async findAll(): Promise<ResponseCommon<Report[]>> {
    const reports = await this.reportRepository.find({
      relations: ['reporter', 'doctor', 'appointment'],
      order: { createdAt: 'DESC' },
    });
    return new ResponseCommon(200, 'SUCCESS', reports);
  }

  async findOne(id: string): Promise<ResponseCommon<Report>> {
    const report = await this.reportRepository.findOne({
      where: { id },
      relations: ['reporter', 'doctor', 'appointment'],
    });
    if (!report) {
      throw new NotFoundException(ERROR_MESSAGES.REPORT_NOT_FOUND);
    }
    return new ResponseCommon(200, 'SUCCESS', report);
  }

  async findByReporter(reporterId: string): Promise<ResponseCommon<Report[]>> {
    const reports = await this.reportRepository.find({
      where: { reporterId },
      relations: ['doctor', 'appointment'],
      order: { createdAt: 'DESC' },
    });
    return new ResponseCommon(200, 'SUCCESS', reports);
  }

  async findByDoctor(doctorId: string): Promise<ResponseCommon<Report[]>> {
    const reports = await this.reportRepository.find({
      where: { doctorId },
      relations: ['reporter'],
      order: { createdAt: 'DESC' },
    });
    return new ResponseCommon(200, 'SUCCESS', reports);
  }

  async update(
    id: string,
    updateReportDto: UpdateReportDto,
    adminId?: string,
  ): Promise<ResponseCommon<Report>> {
    const report = await this.reportRepository.findOne({ where: { id } });
    if (!report) {
      throw new NotFoundException(ERROR_MESSAGES.REPORT_NOT_FOUND);
    }

    const updateData: Partial<Report> = { ...updateReportDto };

    // If resolving, add resolved info
    if (updateReportDto.status === ReportStatus.RESOLVED) {
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = adminId;
    }

    await this.reportRepository.update(id, updateData);
    return this.findOne(id);
  }

  async remove(id: string): Promise<ResponseCommon<null>> {
    const report = await this.reportRepository.findOne({ where: { id } });
    if (!report) {
      throw new NotFoundException(ERROR_MESSAGES.REPORT_NOT_FOUND);
    }
    await this.reportRepository.delete(id);
    return new ResponseCommon(200, 'Xóa báo cáo thành công', null);
  }
}
