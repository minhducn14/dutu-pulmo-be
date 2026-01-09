import { Injectable } from '@nestjs/common';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { CountryEnum, CountryName } from '../common/enums/country.enum';
import { EthnicityEnum, EthnicityName } from '../common/enums/ethnicity.enum';
import { OccupationEnum, OccupationName } from '../common/enums/job.enum';

@Injectable()
export class EnumService {
  /**
   * Helper to process static data with pagination and search
   */
  private getPaginatedData(
    dataMap: Record<string, string>,
    paginationDto: PaginationDto,
  ) {
    const { page = 1, limit = 10, search } = paginationDto;

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

    const meta = {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPage: Math.ceil(total / limit),
    };

    return { data: paginatedData, meta };
  }

  async getCountries(paginationDto: PaginationDto): Promise<ResponseCommon> {
    const { data } = this.getPaginatedData(CountryName, paginationDto);
    return new ResponseCommon(200, 'SUCCESS', data);
  }

  async getEthnicities(paginationDto: PaginationDto): Promise<ResponseCommon> {
    const { data } = this.getPaginatedData(EthnicityName, paginationDto);
    return new ResponseCommon(200, 'SUCCESS', data);
  }

  async getOccupations(paginationDto: PaginationDto): Promise<ResponseCommon> {
    const { data } = this.getPaginatedData(OccupationName, paginationDto);
    return new ResponseCommon(200, 'SUCCESS', data);
  }
}
