import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as puppeteer from 'puppeteer';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CloudinaryService } from '@/modules/cloudinary/cloudinary.service';
import { Prescription } from '@/modules/medical/entities/prescription.entity';
import { MedicalRecord } from '@/modules/medical/entities/medical-record.entity';
import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';

// ── Handlebars Helpers ──────────────────────────────────────────────────────

Handlebars.registerHelper(
  'eq',
  function (a: unknown, b: unknown, options: Handlebars.HelperOptions) {
    return a === b ? options.fn(this) : options.inverse(this);
  },
);

Handlebars.registerHelper(
  'math',
  function (value: number, operator: string, operand: number) {
    if (operator === '+') return value + operand;
    if (operator === '-') return value - operand;
    return value;
  },
);

// ── Template loader (once at startup) ─────────────────────────────────────

function loadTemplate(filename: string): HandlebarsTemplateDelegate {
  let templatePath = path.join(__dirname, 'templates', filename);
  if (!fs.existsSync(templatePath)) {
    templatePath = path.join(
      process.cwd(),
      'src',
      'modules',
      'pdf',
      'templates',
      filename,
    );
  }
  const html = fs.readFileSync(templatePath, 'utf8');
  return Handlebars.compile(html);
}

// ── PdfService ──────────────────────────────────────────────────────────────

@Injectable()
export class PdfService implements OnModuleDestroy {
  private prescriptionTemplate: HandlebarsTemplateDelegate;
  private medicalRecordTemplate: HandlebarsTemplateDelegate;
  private browserPromise: Promise<puppeteer.Browser> | null = null;

  constructor(
    @InjectRepository(Prescription)
    private readonly prescriptionRepo: Repository<Prescription>,

    @InjectRepository(MedicalRecord)
    private readonly medicalRecordRepo: Repository<MedicalRecord>,

    private readonly cloudinaryService: CloudinaryService,
    private readonly configService: ConfigService,
  ) {
    this.prescriptionTemplate = loadTemplate('prescription.html');
    this.medicalRecordTemplate = loadTemplate('medical-record.html');
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.browserPromise) {
      return;
    }

    const browser = await this.browserPromise.catch(() => null);
    this.browserPromise = null;
    if (browser) {
      await browser.close();
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Generate Prescription PDF → upload to Cloudinary → save URL in DB.
   */
  async generateAndSavePrescriptionPdf(
    prescriptionId: string,
  ): Promise<string> {
    const prescription = await this.prescriptionRepo.findOne({
      where: { id: prescriptionId },
      relations: [
        'patient',
        'patient.user',
        'doctor',
        'doctor.user',
        'items',
        'medicalRecord',
        'medicalRecord.vitalSigns',
      ],
    });

    if (!prescription) {
      throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    const data = this.buildPrescriptionData(prescription);
    const pdfUrl = await this.renderAndUpload(
      this.prescriptionTemplate,
      data,
      `don_thuoc_${prescription.prescriptionNumber}`,
      'prescriptions',
    );

    await this.prescriptionRepo.update(prescriptionId, { pdfUrl });
    return pdfUrl;
  }

  /**
   * Generate Medical Record PDF → upload to Cloudinary → save URL in DB.
   */
  async generateAndSaveMedicalRecordPdf(recordId: string): Promise<string> {
    const record = await this.medicalRecordRepo.findOne({
      where: { id: recordId },
      relations: [
        'patient',
        'patient.user',
        'doctor',
        'doctor.user',
        'appointment',
        'vitalSigns',
        'prescriptions',
        'prescriptions.items',
      ],
    });

    if (!record) {
      throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    const data = this.buildMedicalRecordData(record);
    const pdfUrl = await this.renderAndUpload(
      this.medicalRecordTemplate,
      data,
      `benh_an_${record.recordNumber}`,
      'medical_records',
    );

    await this.medicalRecordRepo.update(recordId, { pdfUrl });
    return pdfUrl;
  }

  // ── Data Builders ─────────────────────────────────────────────────────────

  private buildPrescriptionData(
    prescription: Prescription,
  ): Record<string, unknown> {
    const user = prescription.patient?.user;
    const doctorUser = prescription.doctor?.user;
    const vitalSign = this.getLatestVitalSign(
      prescription.medicalRecord?.vitalSigns,
    );
    const medicalRecord = prescription.medicalRecord;

    const birthYear = user?.dateOfBirth
      ? new Date(user.dateOfBirth).getFullYear()
      : undefined;
    const age = birthYear ? new Date().getFullYear() - birthYear : undefined;

    const medicines = (prescription.items ?? []).map((item, idx) => ({
      index: idx + 1,
      name: item.medicineName,
      dosage: item.dosage,
      frequency: item.frequency,
      instructions: item.instructions ?? undefined,
      quantity: item.quantity,
      unit: item.unit ?? 'viên',
    }));

    return {
      logoUrl: this.config(
        'CLINIC_LOGO',
        'https://res.cloudinary.com/dto1lgngv/image/upload/v1771943840/logo_cezsy0.jpg',
      ),
      clinicName: this.config('CLINIC_NAME', 'Dutu Pulmo'),
      clinicPhone: this.config('CLINIC_PHONE', '0123456789'),
      prescriptionCode: prescription.prescriptionNumber,
      patientCode:
        prescription.patient?.profileCode ??
        prescription.patientId?.slice(0, 8).toUpperCase(),
      patientName: user?.fullName ?? 'Bệnh nhân',
      gender: this.formatGender(user?.gender),
      age,
      birthYear,
      heartRate: vitalSign?.heartRate ?? undefined,
      bloodPressure: vitalSign?.bloodPressure ?? undefined,
      temperature:
        vitalSign?.temperature != null
          ? Number(vitalSign.temperature)
          : undefined,
      height: vitalSign?.height ?? undefined,
      weight: vitalSign?.weight ?? undefined,
      patientPhone: user?.phone ?? undefined,
      address: user?.address ?? undefined,
      diagnosisName: medicalRecord?.diagnosis ?? 'Chưa có chẩn đoán',
      diagnosisCode: medicalRecord?.primaryDiagnosis ?? undefined,
      medicines,
      advice: prescription.instructions ?? undefined,
      doctorName: doctorUser?.fullName ?? 'Bác sĩ',
      revisitDate: prescription.validUntil
        ? this.formatDate(prescription.validUntil)
        : undefined,
      prescriptionDate: this.formatDate(prescription.createdAt),
    };
  }

  private buildMedicalRecordData(
    record: MedicalRecord,
  ): Record<string, unknown> {
    const patientUser = record.patient?.user;
    const doctorUser = record.doctor?.user;
    const vitalSign = this.getLatestVitalSign(record.vitalSigns);

    const birthYear = patientUser?.dateOfBirth
      ? new Date(patientUser.dateOfBirth).getFullYear()
      : undefined;
    const age = birthYear ? new Date().getFullYear() - birthYear : undefined;

    const hasVitalSigns = !!(
      vitalSign?.heartRate ||
      vitalSign?.bloodPressure ||
      vitalSign?.temperature ||
      vitalSign?.spo2 ||
      vitalSign?.height ||
      vitalSign?.weight
    );

    const prescriptions = (record.prescriptions ?? []).map((p) => ({
      prescriptionNumber: p.prescriptionNumber,
      notes: p.notes ?? undefined,
      items: (p.items ?? []).map((item) => ({
        medicineName: item.medicineName,
        dosage: item.dosage,
        frequency: item.frequency,
        quantity: item.quantity,
        unit: item.unit ?? 'viên',
        instructions: item.instructions ?? undefined,
      })),
    }));

    return {
      logoUrl: this.config(
        'CLINIC_LOGO',
        'https://res.cloudinary.com/dto1lgngv/image/upload/v1771943840/logo_cezsy0.jpg',
      ),
      clinicName: this.config('CLINIC_NAME', 'Phòng Khám Dutu Pulmo'),
      clinicPhone: this.config('CLINIC_PHONE', '0123456789'),
      recordNumber: record.recordNumber,
      patientCode:
        record.patient?.profileCode ??
        record.patientId?.slice(0, 8).toUpperCase(),
      patientName: patientUser?.fullName ?? 'Bệnh nhân',
      gender: this.formatGender(patientUser?.gender),
      age,
      birthYear,
      patientPhone: patientUser?.phone ?? undefined,
      address: patientUser?.address ?? undefined,
      doctorName: doctorUser?.fullName ?? 'Bác sĩ',
      appointmentNumber: record.appointment?.appointmentNumber ?? undefined,
      recordType: record.recordType ?? 'Bệnh án Ngoại trú chung',
      signedStatus: record.signedStatus,
      createdDate: this.formatDate(record.createdAt),
      hasVitalSigns,
      vitalSigns: {
        heartRate: vitalSign?.heartRate ?? undefined,
        bloodPressure: vitalSign?.bloodPressure ?? undefined,
        temperature:
          vitalSign?.temperature != null
            ? Number(vitalSign.temperature)
            : undefined,
        spo2: vitalSign?.spo2 ?? undefined,
        respiratoryRate: vitalSign?.respiratoryRate ?? undefined,
        height: vitalSign?.height ?? undefined,
        weight: vitalSign?.weight ?? undefined,
        bmi: vitalSign?.bmi ?? undefined,
      },
      chiefComplaint: record.chiefComplaint ?? undefined,
      presentIllness: record.presentIllness ?? undefined,
      medicalHistory: record.medicalHistory ?? undefined,
      familyHistory: record.familyHistory ?? undefined,
      allergies: record.allergies ?? [],
      chronicDiseases: record.chronicDiseases ?? [],
      smokingText: record.smokingStatus
        ? `Có${record.smokingYears ? ` (${record.smokingYears} năm)` : ''}`
        : 'Không',
      alcoholText: record.alcoholConsumption ? 'Có' : 'Không',
      physicalExamNotes: record.physicalExamNotes ?? undefined,
      systemsReview: record.systemsReview ?? undefined,
      diagnosis: record.diagnosis ?? undefined,
      primaryDiagnosis: record.primaryDiagnosis ?? undefined,
      secondaryDiagnosis: record.secondaryDiagnosis ?? undefined,
      treatmentPlan: record.treatmentPlan ?? undefined,
      treatmentGiven: record.treatmentGiven ?? undefined,
      treatmentStartDate: record.treatmentStartDate
        ? this.formatDate(record.treatmentStartDate)
        : undefined,
      treatmentEndDate: record.treatmentEndDate
        ? this.formatDate(record.treatmentEndDate)
        : undefined,
      dischargeDiagnosis: record.dischargeDiagnosis ?? undefined,
      dischargeCondition: this.formatDischargeCondition(
        record.dischargeCondition,
      ),
      followUpInstructions: record.followUpInstructions ?? undefined,
      hasPrescription: prescriptions.length > 0,
      prescriptions,
      fullRecordSummary: record.fullRecordSummary ?? undefined,
    };
  }

  // ── Core Engine ───────────────────────────────────────────────────────────

  private getLatestVitalSign(
    vitalSigns?: MedicalRecord['vitalSigns'],
  ): MedicalRecord['vitalSigns'][number] | null {
    if (!vitalSigns?.length) {
      return null;
    }

    return vitalSigns
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  }

  private async renderAndUpload(
    template: HandlebarsTemplateDelegate,
    data: Record<string, unknown>,
    fileName: string,
    folder: string,
  ): Promise<string> {
    const html = template(data);
    const tmpPath = path.join(os.tmpdir(), `${fileName}_${Date.now()}.pdf`);

    try {
      await this.generatePdfFile(html, tmpPath);
      const result = await this.cloudinaryService.uploadPdfFile(
        tmpPath,
        folder,
        fileName,
      );
      return result.url;
    } finally {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    }
  }

  private async generatePdfFile(
    html: string,
    outputPath: string,
  ): Promise<void> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });
      await page.pdf({
        path: outputPath,
        format: 'A4',
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '12mm' },
        printBackground: true,
      });
    } finally {
      await page.close();
    }
  }

  private async getBrowser(): Promise<puppeteer.Browser> {
    if (!this.browserPromise) {
      this.browserPromise = puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      });
    }

    try {
      return await this.browserPromise;
    } catch (error) {
      this.browserPromise = null;
      throw error;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private config(key: string, fallback: string): string {
    return this.configService.get<string>(key) ?? fallback;
  }

  private formatDate(date: Date | string | undefined | null): string {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private formatGender(gender: string | null | undefined): string {
    if (!gender) return 'Không xác định';
    const g = gender.toLowerCase();
    if (g === 'male' || g === 'nam') return 'Nam';
    if (g === 'female' || g === 'nữ' || g === 'nu') return 'Nữ';
    return gender;
  }

  private formatDischargeCondition(
    condition: string | null | undefined,
  ): string | undefined {
    if (!condition) return undefined;
    const condMap: Record<string, string> = {
      improved: 'Khỏi bệnh',
      stable: 'Đỡ, cần tiếp tục điều trị',
      unchanged: 'Không thay đổi',
      worsened: 'Nặng hơn',
      deceased: 'Tử vong',
    };
    return condMap[condition] || condition;
  }
}
