import { describe, expect, it } from 'vitest';
import { InvalidParameterError } from '@core/index';
import { port, PORT_BUNDLES, portMapToSpecs } from './ports';

describe('ports', () => {
  it('builds analog, pulse, and bundle ports and converts to PortSpec lists', () => {
    const analog = port.analog({ range: [-1, 1], unit: 'normalized', description: 'steering' });
    expect(analog).toEqual({
      kind: 'analog',
      range: [-1, 1],
      unit: 'normalized',
      description: 'steering',
    });

    const pulse = port.pulse({ description: 'pain spike', merge: 'max' });
    expect(pulse.kind).toBe('pulse');
    expect(pulse.range).toEqual([0, 1]);
    expect(pulse.merge).toBe('max');

    const behavior = port.bundle('behavior');
    expect(Object.keys(behavior)).toEqual(Object.keys(PORT_BUNDLES['behavior'] ?? {}));

    const prefixed = port.bundle('behavior', 'flee', 'max');
    expect(Object.keys(prefixed)).toEqual(['flee.urgency', 'flee.turn', 'flee.forward']);
    expect(prefixed['flee.urgency']?.merge).toBe('max');

    const specs = portMapToSpecs(prefixed);
    expect(specs).toHaveLength(3);
    expect(specs[0]?.port).toBe('flee.urgency');
  });

  it('rejects invalid ranges, counts, empty descriptions, and unknown bundles', () => {
    expect(() => port.analog({ range: [2, 1], description: 'bad' })).toThrow(InvalidParameterError);
    expect(() => port.analog({ count: 0, description: 'bad' })).toThrow(InvalidParameterError);
    expect(() => port.pulse({ description: '  ' })).toThrow(InvalidParameterError);
    expect(() => port.bundle('nonexistent')).toThrow(InvalidParameterError);
  });
});
