jest.mock('../treeTable', () => ({
    makeTreeTable: jest.fn()
}))

const updateTreeMap = require('../treeMap')

describe('treeMap', () => {
    it('creates child nodes for parent specific values', () => {
        const mockChart = {
            setOption: jest.fn()
        }

        const mockTable = {} 
        const postings = [
            { accounts: ['Income', 'Gehalt'], amount: 10000 },
            { accounts: ['Income', 'Gehalt', 'Streikgeld'], amount: 2000 },
            { accounts: ['Income', 'Gehalt', 'Sonstiges'], amount: 2400 },
        ]
        const formatter = (val) => val.toString()
        
        // flip is false
        updateTreeMap(mockChart, mockTable, postings, false, formatter)
        
        const call = mockChart.setOption.mock.calls[0][0]
        const rootChildren = call.series[0].data
        
        // root should be Income
        // and its children should be Gehalt
        expect(rootChildren.length).toBe(1)
        expect(rootChildren[0].path).toBe('Income/Gehalt')
        
        // Gehalt should have 3 children: Streikgeld, Sonstiges, and "Gehalt" (the direct amount)
        const gehaltChildren = rootChildren[0].children
        expect(gehaltChildren.length).toBe(3)
        
        // Let's check the amounts
        const directGehalt = gehaltChildren.find(c => c.name.startsWith('Gehalt'))
        expect(directGehalt).toBeDefined()
        expect(directGehalt.value).toBe(10000)
    })
})
