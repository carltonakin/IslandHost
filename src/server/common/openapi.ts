import { ApiProperty } from '@nestjs/swagger';
import { getMetadataStorage } from 'class-validator';
import * as marketplace from '../marketplace/marketplace.dto';
import * as auth from '../auth/auth.dto';
import * as catalog from '../catalog/catalog.dto';
import * as crm from '../crm/crm.dto';
import * as requests from '../requests/requests.dto';
import * as system from '../system/system.dto';
import { ListDto } from './dto';

// Derive request schemas from the same DTO metadata used by runtime validation.
export function registerRequestSchemas() {
 const constructors=[...Object.values(marketplace),...Object.values(auth),...Object.values(catalog),...Object.values(crm),...Object.values(requests),...Object.values(system),ListDto];
 for(const dto of constructors) {
  const validations=getMetadataStorage().getTargetValidationMetadatas(dto,'',false,false);
  for(const property of new Set(validations.map(v=>v.propertyName))) {
   const rules=validations.filter(v=>v.propertyName===property);
   const reflected=Reflect.getMetadata('design:type',dto.prototype,property);
   const choices=rules.find(v=>v.name==='isIn')?.constraints?.[0];
   ApiProperty({
    required:!rules.some(v=>v.type==='conditionalValidation'),
    type:property==='Items'&&dto===marketplace.ImportPlanDto?()=>marketplace.PlanItemDto:property==='Options'?()=>catalog.OptionDto:reflected===Array?String:reflected,
    isArray:reflected===Array,
    ...(Array.isArray(choices)?{enum:choices}:{}),
    description:property.replace(/([a-z])([A-Z])/g,'$1 $2')
   })(dto.prototype,property);
  }
 }
}
