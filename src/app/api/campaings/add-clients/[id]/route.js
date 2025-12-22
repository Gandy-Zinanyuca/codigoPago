import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req) {
  try {
    const {
      nombre_campanha,
      descripcion,
      template_id,
      fecha_inicio,
      fecha_fin,
      clients,
      variableMappings,
      // filters ya no se usa
    } = await req.json();

    // Validar que haya clientes
    if (!clients || clients.length === 0) {
      return NextResponse.json(
        { error: "No hay clientes para agregar a la campaña" },
        { status: 400 }
      );
    }

    console.log(`📋 Creando campaña con ${clients.length} clientes`);

    // 1. Crear la campaña
    const campanha = await prisma.campanha.create({
      data: {
        nombre_campanha,
        descripcion: descripcion || "Sin descripción",
        template_id: template_id ? parseInt(template_id) : null,
        fecha_inicio: fecha_inicio ? new Date(fecha_inicio) : new Date(),
        fecha_fin: fecha_fin ? new Date(fecha_fin) : null,
        variable_mappings: variableMappings || {},
        estado_campanha: "activa",
        num_clientes: clients.length,
        tipo: "in",
      },
    });

    // 2. Preparar datos para guardar en campanha_temporal
    const dataToInsert = clients.map((cliente) => {
      // Normalizar el número de teléfono
      let celular = cliente.celular || cliente.telefono || "";
      
      if (celular) {
        // Remover espacios y caracteres no numéricos excepto +
        celular = celular.toString().replace(/\s+/g, "").trim();
        
        // Agregar +51 si no tiene prefijo
        if (!celular.startsWith("+")) {
          celular = `+51${celular}`;
        }
      }

      return {
        campanha_id: campanha.campanha_id,
        celular: celular || null,
        nombre: cliente.nombre || cliente.Nombre || null,
      };
    }).filter(c => c.celular); // Solo los que tienen celular válido

    console.log(`📞 Clientes válidos: ${dataToInsert.length}`);

    // 3. Guardar clientes en campanha_temporal
    let result = { count: 0 };
    
    if (dataToInsert.length > 0) {
      result = await prisma.campanha_temporal.createMany({
        data: dataToInsert,
        skipDuplicates: true,
      });
      
      console.log(`✅ ${result.count} clientes guardados en campanha_temporal`);
    }

    return NextResponse.json({
      success: true,
      message: "Campaña creada y clientes asociados exitosamente",
      campanha_id: campanha.campanha_id,
      clientes_guardados: result.count,
      campanha: {
        campanha_id: campanha.campanha_id,
        nombre_campanha: campanha.nombre_campanha,
        descripcion: campanha.descripcion,
        estado_campanha: campanha.estado_campanha,
        num_clientes: campanha.num_clientes,
        fecha_inicio: campanha.fecha_inicio,
        fecha_fin: campanha.fecha_fin,
      },
    });

  } catch (error) {
    console.error("❌ Error al crear campaña:", error);
    
    return NextResponse.json(
      {
        error: "Error al crear la campaña o agregar los clientes",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
