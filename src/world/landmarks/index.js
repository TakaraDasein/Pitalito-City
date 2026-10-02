import { ParquePrincipal } from './ParquePrincipal.js';
import { CatedralSanAntonio } from './CatedralSanAntonio.js';
import { AlcaldiaChapolera } from './AlcaldiaChapolera.js';
import { ColiseoCubierto } from './ColiseoCubierto.js';
import { ConchaAcustica } from './ConchaAcustica.js';
import { VillaOlimpica, Patinodromo, TerminalTransportes } from './RecintosDeportivos.js';

// Registro de hitos hechos a mano. Para agregar uno:
//  1. Marcar su polígono en scripts/build-world.mjs (landmarks.<id>)
//  2. Crear un módulo con { id, name, available, exclusion, build, update? }
//  3. Agregarlo a esta lista.
export const LANDMARKS = [ParquePrincipal, CatedralSanAntonio, AlcaldiaChapolera, ColiseoCubierto, ConchaAcustica,
  VillaOlimpica, Patinodromo, TerminalTransportes];
