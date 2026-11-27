import { z } from 'zod';
import { FeedforwardNetwork } from '@oxyrlab/neuro-learn';
import { port, type PortDef, type PortHandle, type PortMap } from '@bus/ports';
import { defineBrainModule } from '../module-def';

/**
 * Zod parameter schema for {@link nnControllerModule}.
 */
export const nnControllerParamsSchema = z.object({
  inputCount: z.number().int().min(1).max(32).default(4),
  hiddenSizes: z.array(z.number().int().min(1).max(32)).max(3).default([6]),
  outputCount: z.number().int().min(1).max(16).default(2),
  hiddenActivation: z.enum(['tanh', 'relu', 'sigmoid', 'linear']).default('tanh'),
  outputActivation: z.enum(['tanh', 'relu', 'sigmoid', 'linear']).default('tanh'),
  weights: z.array(z.number().finite()).optional(),
});

/** Validated parameters for {@link nnControllerModule}. */
export type NnControllerParams = z.infer<typeof nnControllerParamsSchema>;

/**
 * Evolvable feedforward neural-network brain module (`kind: 'nn'`) backed by
 * `@oxyrlab/neuro-learn`'s allocation-free `FeedforwardNetwork`.
 *
 * Exposes spatial array ports `in` (`count = inputCount`, range `[-1, 1]`) and `out`
 * (`count = outputCount`, range `[-1, 1]`). Weights can be supplied in `params.weights` for
 * genome inheritance and evolutionary mutation.
 */
export const nnControllerModule = defineBrainModule({
  id: 'nn-controller',
  kind: 'nn',
  description:
    'Allocation-free feedforward neural network controller backed by @oxyrlab/neuro-learn with evolvable weights.',
  params: nnControllerParamsSchema,
  inputs(params): PortMap {
    const map: Record<string, PortDef> = {
      in: port.analog({
        count: params.inputCount,
        range: [-1, 1],
        unit: 'normalized',
        description: 'Input feature vector fed into the neural network.',
      }),
    };
    return map;
  },
  outputs(params): PortMap {
    const map: Record<string, PortDef> = {
      out: port.analog({
        count: params.outputCount,
        range: [-1, 1],
        unit: 'normalized',
        description: 'Output command vector produced by the neural network.',
      }),
    };
    return map;
  },
  create(params, { inputs, outputs }, rng) {
    const layerSizes = [params.inputCount, ...params.hiddenSizes, params.outputCount];
    const net = new FeedforwardNetwork({
      layerSizes,
      rng,
      hiddenActivation: params.hiddenActivation,
      outputActivation: params.outputActivation,
    });
    if (params.weights !== undefined && params.weights.length === net.stateSize) {
      net.restore(Float32Array.from(params.weights));
    }

    const inBuf = new Float32Array(params.inputCount);
    const outBuf = new Float32Array(params.outputCount);
    const inH = inputs['in'] as PortHandle;
    const outH = outputs['out'] as PortHandle;

    return {
      tick(input, output) {
        for (let i = 0; i < params.inputCount; i += 1) {
          inBuf[i] = input.get(inH, i);
        }
        net.forward(inBuf, outBuf);
        for (let i = 0; i < params.outputCount; i += 1) {
          output.set(outH, outBuf[i] as number, i);
        }
      },
      serialize() {
        return {
          layerSizes,
          stateSize: net.stateSize,
          weights: Array.from(net.serialize()),
        };
      },
    };
  },
});
