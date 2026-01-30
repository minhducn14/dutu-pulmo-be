import { Injectable, HttpStatus } from '@nestjs/common';
import {
  PaginationDto,
  PaginatedResponseDto,
} from '@/common/dto/pagination.dto';
import { ResponseCommon } from '@/common/dto/response.dto';
import { CountryName } from '@/modules/common/enums/country.enum';
import { EthnicityName } from '@/modules/common/enums/ethnicity.enum';
import { OccupationName } from '@/modules/common/enums/job.enum';
import { EnumItemDto } from '@/modules/enum/dto/enum-item.dto';

@Injectable()
export class EnumService {
  /**
   * Helper to process static data with pagination and search
   */
  private getPaginatedData(
    dataMap: Record<string, string>,
    paginationDto: PaginationDto,
  ): PaginatedResponseDto<EnumItemDto> {
    const page = paginationDto.page ?? 1;
    const limit = paginationDto.limit ?? 10;
    const search = paginationDto.search;

    // Convert Record to Array
    let data = Object.entries(dataMap).map(([code, name]) => ({
      code,
      name,
    }));

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      data = data.filter((item) =>
        item.name.toLowerCase().includes(searchLower),
      );
    }

    // Pagination logic
    const total = data.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = data.slice(startIndex, endIndex);

    const items = paginatedData.map((item) => EnumItemDto.fromEntry(item));
    return new PaginatedResponseDto(items, total, page, limit);
  }

  private getPaginatedDataRandom(
    dataMap: Record<string, string>,
    paginationDto: PaginationDto,
  ): PaginatedResponseDto<EnumItemDto> {
    const page = paginationDto.page ?? 1;
    const limit = paginationDto.limit ?? 10;
    const search = paginationDto.search;
    const random = true;

    let data = Object.entries(dataMap).map(([code, name]) => ({
      code,
      name,
    }));

    if (search) {
      const searchLower = search.toLowerCase();
      data = data.filter((item) =>
        item.name.toLowerCase().includes(searchLower),
      );
    }

    if (random) {
      data = this.shuffleArray(data);
    }

    const total = data.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = data.slice(startIndex, endIndex);

    const items = paginatedData.map((item) => EnumItemDto.fromEntry(item));
    return new PaginatedResponseDto(items, total, page, limit);
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  getCountries(
    paginationDto: PaginationDto,
  ): ResponseCommon<PaginatedResponseDto<EnumItemDto>> {
    const data = this.getPaginatedData(CountryName, paginationDto);
    return new ResponseCommon(HttpStatus.OK, 'SUCCESS', data);
  }

  getEthnicities(
    paginationDto: PaginationDto,
  ): ResponseCommon<PaginatedResponseDto<EnumItemDto>> {
    const data = this.getPaginatedData(EthnicityName, paginationDto);
    return new ResponseCommon(HttpStatus.OK, 'SUCCESS', data);
  }

  getOccupations(
    paginationDto: PaginationDto,
  ): ResponseCommon<PaginatedResponseDto<EnumItemDto>> {
    const data = this.getPaginatedDataRandom(OccupationName, paginationDto);
    return new ResponseCommon(HttpStatus.OK, 'SUCCESS', data);
  }
}
