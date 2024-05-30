import { Request, Response } from "express";
import AbstractController from "./AbstractController";
import db from "../models";
import { Op } from "sequelize";

class LlamadaController extends AbstractController {
  //Singleton
  //Atributo de clase
  private static _instance: LlamadaController;
  //Método de clase
  public static get instance(): AbstractController {
    if (!this._instance) {
      this._instance = new LlamadaController("llamada");
    }
    return this._instance;
  }

  //Declarar todas las rutas del controlador
  protected initRoutes(): void {
    this.router.get("/test", this.getTest.bind(this));
    this.router.get("/consultarLlamadas", this.getConsultarLlamadas.bind(this));
    this.router.post("/crearLlamada", this.postCrearLlamada.bind(this));
    this.router.delete("/eliminarLlamada/:id", this.deleteBorrarLlamada.bind(this));
    this.router.post("/crearIncidencia", this.postCrearIncidencia.bind(this));
    this.router.post("/crearEncuesta", this.postCrearEncuesta.bind(this));
    this.router.get("/infoTarjetas", this.getInfoTarjetas.bind(this));
    this.router.get("/infoTarjetasV2", this.getInfoTarjetasV2.bind(this));
    this.router.put("/actualizarLlamada", this.putActualizarLlamada.bind(this));
    this.router.get("/infoIncidencias", this.getInfoIncidencias.bind(this));
    this.router.get('/consultarSolucion/:asunto', this.getConsultarSolucion.bind(this));
    this.router.get('/consultarSoluciones', this.getConsultarSoluciones.bind(this));
    this.router.get("/llamadasDeHoy", this.getLlamadasDeHoy.bind(this));
    this.router.get("/negativeCallsCount", this.getNegativeCallsCount.bind(this)); //Notificaciones
    this.router.get("/averageCallDuration", this.getAverageCallDuration.bind(this)); //Notificaciones
  }

  private async getConsultarSoluciones(req: Request, res: Response) {
    try {
      let soluciones = await db["SolucionBase"].findAll();

      if (soluciones.length == 0) {
        return res.status(404).send("No se encontraron soluciones");
      }

      res.status(200).json(soluciones);

    } catch (err: any) {
      console.log(err);
      res.status(500).send('Internal server error' + err);
    }
  }

  private async getConsultarSolucion(req: Request, res: Response) {
    try {
      const { asunto } = req.params;
      const soluciones = await db.SolucionBase.findAll({
        where: { Asunto: asunto },
        attributes: ['IdSolucion', 'Nombre', 'Asunto'],
        include: [
          {
            model: db.Pasos,
            as: 'Pasos',
            attributes: ['Descripcion']
          }
        ]
      });

      if (!soluciones) {
        return res.status(404).send("No se encontraron soluciones");
      }
      res.status(200).json(soluciones);

    } catch (err: any) {
      console.log(err);
      res.status(500).send('Internal server error' + err);

    }
  }

  private async getLlamadasDeHoy(req: Request, res: Response) {
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0); // Establece la hora al inicio del día

      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999); // Establece la hora al final del día

      const llamadasDeHoy = await db.Llamada.count({
        where: {
          fechaHora: {
            [Op.between]: [startOfToday, endOfToday],
          },
        },
      });

      res.status(200).json({ llamadasDeHoy });
    } catch (err) {
      console.log(err);
      res.status(500).send("Internal server error" + err);
    }
  }

  private async getInfoIncidencias(req: Request, res: Response) {
    try {
      const incidencia = await db.sequelize.query(`
        SELECT *, Incidencia.Nombre as NombreIncidencia, Zona.Nombre as NombreZona
        FROM Reporte
        JOIN Incidencia ON Reporte.IdIncidencia = Incidencia.IdIncidencia
        JOIN Zona ON Reporte.IdZona = Zona.IdZona
      `, { type: db.sequelize.QueryTypes.SELECT });

      res.status(200).json(incidencia);
    } catch (err) {
      console.log(err);
      res.status(500).send("Internal server error" + err);
    }
  }

  private async getInfoIncidenciasV2() {
    try {
      const incidencia = await db.sequelize.query(`
        SELECT *, Incidencia.Nombre as NombreIncidencia, Zona.Nombre as NombreZona
        FROM Reporte
        JOIN Incidencia ON Reporte.IdIncidencia = Incidencia.IdIncidencia
        JOIN Zona ON Reporte.IdZona = Zona.IdZona
      `, { type: db.sequelize.QueryTypes.SELECT });

      return incidencia;
    } catch (err) {
      console.log(err);
    }
  }

  private async getInfoTarjetasV2(req: Request, res: Response) {
    try {
      const llamadas = await db.sequelize.query(`
      SELECT 
          L.Asunto, L.Sentiment, L.Notas, L.IdLlamada, L.Estado,
          Cliente.Nombre AS CName, Cliente.ApellidoP AS CLastName, Cliente.Celular,
          Zona.Nombre AS ZoneName, 
          Empleado.Nombre, Empleado.ApellidoP, 
          Contrato.Fecha, Paquete.Nombre AS PName, Paquete.Precio,
          (SELECT COUNT(*) FROM Llamada AS Llamadas WHERE Llamadas.IdEmpleado = Empleado.IdEmpleado) AS numLlamadas 
      FROM Empleado
      LEFT JOIN Llamada AS L ON L.IdEmpleado = Empleado.IdEmpleado AND L.FechaHora = (
              SELECT MAX(L2.FechaHora) 
              FROM Llamada AS L2 
              WHERE L2.IdEmpleado = Empleado.IdEmpleado)
      LEFT JOIN Cliente ON L.Celular = Cliente.Celular
      LEFT JOIN Zona ON Cliente.IdZona = Zona.IdZona
      LEFT JOIN Contrato ON Cliente.Celular = Contrato.Celular
      LEFT JOIN Paquete ON Contrato.IdPaquete = Paquete.IdPaquete  
      ORDER BY Empleado.IdEmpleado;
      `, { type: db.sequelize.QueryTypes.SELECT });

      res.status(200).json(llamadas);
    } catch (err) {
      console.log(err);
      res.status(500).send("Internal server error" + err);
    }
  }

  private async getInfoTarjetas(req: Request, res: Response) {
    try {
      let llamada = await db.Llamada.findAll({
        where: { Estado: true },
        attributes: ["Asunto", "Sentiment", "Notas"],
        include: [
          {
            model: db.Cliente,
            as: "Cliente",
            attributes: ["Nombre", "ApellidoP"],
            include: [
              {
                model: db.Zona,
                as: "Zona",
                attributes: ["Nombre"],
              },
            ],
          },
          {
            model: db.Empleado,
            as: "Empleado",
            attributes: [
              "Nombre",
              "ApellidoP",
              [
                db.sequelize.literal(`(
                                SELECT COUNT(*)
                                FROM Llamada AS Llamadas
                                WHERE Llamadas.IdEmpleado = Empleado.IdEmpleado
                            )`),
                "numLlamadas",
              ],
            ],
          },
        ],
      });

      // Si no la encuentra
      if (!llamada) {
        return res.status(404).send("No hay llamadas activas");
      }

      res.status(200).json(llamada);
    } catch (err) {
      console.log(err);
      res.status(500).send("Internal server error" + err);
    }
  }

  private async putActualizarLlamada(req: Request, res: Response) {
    try {
      const { id } = req.body;
      const { IdEmpleado } = req.body;
      const actLlamada = await db.Llamada.update(
        { IdEmpleado },
        { where: { IdLlamada: id } }
      );

      // Emitir evento de socket
      const io = req.app.get("socketio");
      if (io) {
        io.emit("newCall", actLlamada);
      } else {
        console.log("Socket.IO no está disponible");
      }

      res.status(200).send("<h1>Llamada actualizada</h1>");
    } catch (error: any) {
      console.log(error);
      res.status(500).send("Internal server error" + error);
    }
  }

  private getTest(req: Request, res: Response) {
    try {
      console.log("Prueba exitosa");
      res.status(200).send("<h1>Prueba exitosa</h1>");
    } catch (error: any) {
      console.log(error);
      res.status(500).send("Internal server error" + error);
    }
  }

  private async getConsultarLlamadas(req: Request, res: Response) {
    try {
      let llamadas = await db["Llamada"].findAll();
      res.status(200).json(llamadas);
    } catch (err) {
      console.log(err);
      res.status(500).send("Internal server error" + err);
    }
  }

  private async getAverageCallDuration(req: Request, res: Response) {
    try {
      let averageDuration = await db["Llamada"].findAll({
        attributes: [[db.Sequelize.fn('AVG', db.Sequelize.col('Duracion')), 'averageDuration']]
      });
      res.status(200).json(averageDuration);
    } catch (err) {
      console.log(err);
      res.status(500).send("Internal server error" + err);
    }
  }



  private async getNegativeCallsCount(req: Request, res: Response) {
    try {
      let count = await db["Llamada"].count({
        where: { Estado: false, Sentiment: "NEGATIVE" }
      });
      res.status(200).json({ count });
    } catch (err) {
      console.log(err);
      res.status(500).send("Internal server error" + err);
    }
  }



  // private async postCrearLlamada(req: Request, res: Response) {
  //   try {
  //     console.log(req.body);
  //     const nuevaLlamada = await db.Llamada.create(req.body); // Insert
  //     console.log("Llamada creada");

  //     // Emitir evento de socket
  //     const io = req.app.get("socketio");
  //     if (io) {
  //       io.emit("reloadPage");
  //       console.log("Evento emitido");
  //     } else {
  //       console.log("Socket.IO no está disponible");
  //     }

  //     res.status(200).send("<h1>Llamada creada</h1>");
  //   } catch (err) {
  //     console.log(err);
  //     res.status(500).send("Internal server error" + err);
  //   }
  // }

  private async getInfoTarjetasV3() {
    try {
      const llamadas = await db.sequelize.query(`
      SELECT 
          L.Asunto, L.Sentiment, L.Notas, L.IdLlamada, L.Estado,
          Cliente.Nombre AS CName, Cliente.ApellidoP AS CLastName, Cliente.Celular,
          Zona.Nombre AS ZoneName, 
          Empleado.Nombre, Empleado.ApellidoP, 
          Contrato.Fecha, Paquete.Nombre AS PName, Paquete.Precio,
          (SELECT COUNT(*) FROM Llamada AS Llamadas WHERE Llamadas.IdEmpleado = Empleado.IdEmpleado) AS numLlamadas 
      FROM Empleado
      LEFT JOIN Llamada AS L ON L.IdEmpleado = Empleado.IdEmpleado AND L.FechaHora = (
              SELECT MAX(L2.FechaHora) 
              FROM Llamada AS L2 
              WHERE L2.IdEmpleado = Empleado.IdEmpleado)
      LEFT JOIN Cliente ON L.Celular = Cliente.Celular
      LEFT JOIN Zona ON Cliente.IdZona = Zona.IdZona
      LEFT JOIN Contrato ON Cliente.Celular = Contrato.Celular
      LEFT JOIN Paquete ON Contrato.IdPaquete = Paquete.IdPaquete  
      ORDER BY Empleado.IdEmpleado;
    `, { type: db.sequelize.QueryTypes.SELECT });

      return llamadas;
    } catch (err) {
      console.log(err);
      throw new Error("Internal server error" + err);
    }
  }

  private async postCrearLlamada(req: Request, res: Response) {
    try {
      console.log(req.body);
      const nuevaLlamada = await db.Llamada.create(req.body); // Insert
      console.log("Llamada creada");

      // Emitir evento de socket
      const io = req.app.get("socketio");
      if (io) {
        const llamadas = await this.getInfoTarjetasV3();
        io.emit("newPage", llamadas);
        console.log("Evento emitido");
      } else {
        console.log("Socket.IO no está disponible");
      }

      res.status(200).send("<h1>Llamada creada</h1>");
    } catch (err) {
      console.log(err);
      res.status(500).send("Internal server error" + err);
    }
  }

  private async deleteBorrarLlamada(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await db.Llamada.destroy({ where: { IdLlamada: id } });
      res.status(200).send("<h1>Llamada eliminada</h1>");
    } catch (err) {
      console.log(err);
      res.status(500).send("Internal server error" + err);
    }
  }

  private async postCrearIncidencia(req: Request, res: Response) {
    try {
      console.log(req.body);
      await db.Reporte.create(req.body); //Insert
      console.log("Reporte creado");

      // Emitir evento de socket
      const io = req.app.get("socketio");
      if (io) {
        const incidencias = await this.getInfoIncidenciasV2();
        io.emit("newIncidencia", incidencias);
        console.log("Evento emitido");
      } else {
        console.log("Socket.IO no está disponible");
      }


      res.status(200).send("<h1>Incidencia creada</h1>");
    } catch (err) {
      console.log(err);
      res.status(500).send("Internal server error" + err);
    }
  }

  private async postCrearEncuesta(req: Request, res: Response) {
    try {
      console.log(req.body);
      await db.Encuesta.create(req.body); //Insert
      console.log("Encuesta creada");
      res.status(200).send("<h1>Encuesta creada</h1>");
    } catch (err) {
      console.log(err);
      res.status(500).send("Internal server error" + err);
    }
  }
}

export default LlamadaController;