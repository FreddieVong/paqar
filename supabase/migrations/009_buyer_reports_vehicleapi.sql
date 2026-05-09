-- Store VehicleAPI result on paid buyer reports (lazy fetch, cached)
alter table buyer_reports add column vehicleapi_data jsonb;
