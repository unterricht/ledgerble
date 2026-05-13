const { updateFilterVisibility } = require('../tabVisibility');

describe('tabVisibility', () => {
    let mockFilterContainer;

    beforeEach(() => {
        mockFilterContainer = {
            hide: jest.fn(),
            show: jest.fn()
        };
    });

    it('should hide filter container when target tab is #options', () => {
        updateFilterVisibility('#options', mockFilterContainer);
        expect(mockFilterContainer.hide).toHaveBeenCalled();
        expect(mockFilterContainer.show).not.toHaveBeenCalled();
    });

    it('should show filter container when target tab is #net', () => {
        updateFilterVisibility('#net', mockFilterContainer);
        expect(mockFilterContainer.show).toHaveBeenCalled();
        expect(mockFilterContainer.hide).not.toHaveBeenCalled();
    });

    it('should show filter container when target tab is #balance', () => {
        updateFilterVisibility('#balance', mockFilterContainer);
        expect(mockFilterContainer.show).toHaveBeenCalled();
        expect(mockFilterContainer.hide).not.toHaveBeenCalled();
    });
});
