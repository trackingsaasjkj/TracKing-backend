import { validarPrecio } from "../../domain/rules/validar-precio.rule";

export class CrearServicioUseCase {
  constructor(private servicioRepo) {}

  async execute(data) {

    validarPrecio(data);

    const servicio = await this.servicioRepo.create({
      ...data,
      status: "PENDING"
    });

    return servicio;
  }
}
